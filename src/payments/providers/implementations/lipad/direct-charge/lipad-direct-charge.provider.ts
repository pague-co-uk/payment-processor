import { measureOperation } from "@pague-co-uk/sms-gateway-telemetry";
import { Injectable } from "@nestjs/common";
import { getComponentLogger } from "@pague-co-uk/sms-gateway-telemetry";


import { Prisma, TransactionStatus } from "@prisma/client";
import { PaymentProviderException } from "../../../../../payments/exceptions/payment-provider.exception.js";
import { PaymentValidationException } from "../../../../../payments/exceptions/payment-validation.exception.js";
import { PaymentCallbackRequest, PaymentCallbackResult, PaymentProviderAdapter } from "../../../../../payments/providers/core/interfaces/payment-provider.adapter.js";
import { PaymentProvider } from "../../../../../payments/providers/core/payment-provider.decorator.js";
import { PaymentsRepository } from "../../../../../payments/repositories/payments.repository.js";
import { PaymentRequest } from "../../../core/interfaces/payment-provider.adapter.js";
import type {
  LipadDirectChargeOtpResponse,
  LipadDirectChargeResponse,
} from "./interfaces/lipad-direct-charge.types.js";
import { LipadDirectChargeClient } from "./lipad-direct-charge.client.js";
import { LipadDirectChargeMapper } from "./lipad-direct-charge.mapper.js";


@Injectable()
@PaymentProvider("LIPAD_DIRECT_CHARGE")
export class LipadDirectChargeProvider
  implements PaymentProviderAdapter<LipadDirectChargeResponse> {
  private readonly logger =
    getComponentLogger("lipad-direct-charge-provider");

  constructor(
    private readonly client: LipadDirectChargeClient,
    private readonly mapper: LipadDirectChargeMapper,
    private readonly repository: PaymentsRepository,
  ) { }

  public async execute(
    request: PaymentRequest,
  ): Promise<LipadDirectChargeResponse> {
    return measureOperation('payments.provider.processing', { provider: 'LIPAD_DIRECT_CHARGE', operation: 'execute' }, async () => {
    const transaction = request.transaction;

    const payload =
      this.mapper.toRequest(transaction);

    this.logger.info(
      {
        provider: "LIPAD",
        paymentMethod: "DIRECT_CHARGE",
        transactionId: transaction.id,
        publicId: transaction.publicId,
        reference: transaction.reference,
      },
      "Executing Lipad direct charge.",
    );

    const response =
      await this.client.initiate(payload);

    this.logger.info(
      {
        provider: "LIPAD",
        paymentMethod: "DIRECT_CHARGE",
        transactionId: transaction.id,
        publicId: transaction.publicId,
        reference: transaction.reference,
        chargeRequestId:
          response.charge_request_id,
        statusCode:
          response.status_code,
        nextStep:
          response.next_step,
      },
      "Lipad direct charge request accepted.",
    );

    return response;

    });
  }

  public async handleCallback(
    request: PaymentCallbackRequest,
  ): Promise<PaymentCallbackResult> {
    return measureOperation('payments.provider.processing', { provider: 'LIPAD_DIRECT_CHARGE', operation: 'handleCallback' }, async () => {
    const externalReference =
      this.requiredCallbackString(
        request.fields.external_reference,
        "external_reference",
      );

    const transaction =
      await this.repository.findTransactionByReference(
        externalReference,
      );

    if (!transaction) {
      this.logger.warn(
        {
          provider: "LIPAD",
          paymentMethod: "DIRECT_CHARGE",
          externalReference,
        },
        "Lipad direct charge callback references an unknown transaction.",
      );

      return {
        processed: false,
      };
    }

    const chargeRequestId =
      this.requiredCallbackString(
        request.fields.charge_request_id,
        "charge_request_id",
      );

    const status =
      await this.client.getStatus(
        chargeRequestId,
      );

    const transactionStatus =
      this.mapStatus(status.payment_status);

    await this.repository.applyProviderCallback(
      transaction.id,
      transactionStatus,
      {
        callback: request.fields,
        status,
      } as unknown as Prisma.InputJsonValue,
    );

    this.logger.info(
      {
        provider: "LIPAD",
        paymentMethod: "DIRECT_CHARGE",
        transactionId: transaction.id,
        publicId: transaction.publicId,
        reference: transaction.reference,
        chargeRequestId,
        lipadStatus: status.payment_status,
        transactionStatus,
      },
      "Lipad direct charge callback processed.",
    );

    return {
      processed: true,
    };

    });
  }

  private mapStatus(
    status: unknown,
  ): TransactionStatus {
    if (typeof status !== "number") {
      throw new PaymentProviderException(
        "Lipad direct charge status response did not contain a valid payment status.",
        {
          retryable: true,
        },
      );
    }

    switch (status) {
      case 700:
        return TransactionStatus.SUCCESS;

      case 701:
        return TransactionStatus.FAILED;

      case 702:
        return TransactionStatus.REVERSED;

      case 703:
      case 704:
        return TransactionStatus.PROCESSING;

      default:
        throw new PaymentProviderException(
          `Unsupported Lipad direct charge payment status '${status}'.`,
          {
            retryable: true,
          },
        );
    }
  }

  private requiredCallbackString(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      throw new PaymentValidationException(
        `Lipad direct charge callback field '${field}' is required.`,
      );
    }

    return value.trim();
  }

  /**
 * Verify an OTP for a Lipad Direct Charge transaction.
 *
 * The caller supplies the Pague publicId.
 * The Lipad reference used for the OTP request is
 * resolved from the transaction.
 */
  public async verifyDirectChargeOtp(
    publicId: string,
    otp: string,
  ): Promise<LipadDirectChargeOtpResponse> {
    const transaction =
      await this.repository
        .findTransactionByPublicId(
          publicId,
        );

    if (!transaction) {
      throw new PaymentValidationException(
        `Payment transaction '${publicId}' was not found.`,
      );
    }

    if (
      transaction.status !==
      TransactionStatus.PROCESSING
    ) {
      throw new PaymentValidationException(
        `Payment transaction '${publicId}' is not eligible for OTP verification.`,
      );
    }

    if (!transaction.provider) {
      throw new PaymentValidationException(
        `Payment transaction '${publicId}' does not have an assigned provider.`,
      );
    }

    if (
      transaction.provider.code
        .trim()
        .toUpperCase() !== "LIPAD"
    ) {
      throw new PaymentValidationException(
        `Payment transaction '${publicId}' is not assigned to Lipad.`,
      );
    }

    this.logger.info(
      {
        provider: "LIPAD",
        paymentMethod: "DIRECT_CHARGE",
        transactionId:
          transaction.id,
        publicId:
          transaction.publicId,
      },
      "Verifying Lipad direct charge OTP.",
    );

    return this.client.verifyDirectChargeOtp(
      transaction.reference,
      otp,
    );
  }

}