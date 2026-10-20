import { measureOperation } from "@pague-co-uk/sms-gateway-telemetry";
import {
  Injectable,
} from "@nestjs/common";

import {
  Prisma,
  TransactionStatus,
} from "@prisma/client";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";


import type {
  PaymentCallbackRequest,
  PaymentCallbackResult,
  PaymentProviderAdapter,
  PaymentRequest,
} from "../../../core/interfaces/payment-provider.adapter.js";

import {
  PaymentProvider,
} from "../../../core/payment-provider.decorator.js";

import {
  LipadPaymentMapper,
} from "./lipad-payment.mapper.js";

import {
  PaymentsRepository,
} from "../../../../repositories/payments.repository.js";
import { LipadPayoutsClient } from "./lipad-payouts.client.js";




@Injectable()
@PaymentProvider("LIPAD_PAYOUTS")
export class LipadPayoutsProvider
  implements PaymentProviderAdapter {
  private readonly logger:
    ReturnType<typeof getComponentLogger> =
    getComponentLogger(
      "lipad-payment-provider",
    );

  constructor(
    private readonly client:
      LipadPayoutsClient,

    private readonly mapper:
      LipadPaymentMapper,

    private readonly repository:
      PaymentsRepository,
  ) { }


  public async execute(
    request: PaymentRequest,
  ): Promise<unknown> {
    return measureOperation('payments.provider.processing', { provider: 'LIPAD_PAYOUTS', operation: 'execute' }, async () => {
    const transaction =
      request.transaction;

    const payoutType =
      this.mapper.getPayoutType(
        transaction,
      );

    this.logger.info(
      {
        provider: "LIPAD",
        transactionId:
          transaction.id,
        publicId:
          transaction.publicId,
        reference:
          transaction.reference,
        payoutType,
      },
      "Executing Lipad payment.",
    );

    try {
      switch (payoutType) {

        case "local": {
          const payoutRequest =
            this.mapper.toLocalPayoutRequest(
              transaction,
            );

          const response =
            await this.client
              .initiateLocalPayout(
                payoutRequest,
              );

          this.logger.info(
            {
              provider: "LIPAD",
              transactionId:
                transaction.id,
              publicId:
                transaction.publicId,
              payoutType,
            },
            "Lipad local payout request accepted.",
          );

          return response;
        }


        case "international": {
          const payoutRequest =
            this.mapper
              .toInternationalPayoutRequest(
                transaction,
              );

          const response =
            await this.client
              .initiateInternationalPayout(
                payoutRequest,
              );

          this.logger.info(
            {
              provider: "LIPAD",
              transactionId:
                transaction.id,
              publicId:
                transaction.publicId,
              payoutType,
            },
            "Lipad international payout request accepted.",
          );

          return response;
        }
      }

    } catch (error) {
      this.logger.error(
        {
          provider: "LIPAD",
          transactionId:
            transaction.id,
          publicId:
            transaction.publicId,
          payoutType,
          err: error,
        },
        "Lipad payment execution failed.",
      );

      throw error;
    }

    });
  }


  public async handleCallback(
    request: PaymentCallbackRequest,
  ): Promise<PaymentCallbackResult> {
    return measureOperation('payments.provider.processing', { provider: 'LIPAD_PAYOUTS', operation: 'handleCallback' }, async () => {
    const transaction =
      request.transaction;

    const payoutReference =
      this.requiredString(
        request.fields.payout_reference,
        "payout_reference",
      );

    if (
      transaction.publicId !==
      payoutReference
    ) {
      this.logger.warn(
        {
          provider: "LIPAD",
          transactionId:
            transaction.id,
          publicId:
            transaction.publicId,
          callbackReference:
            payoutReference,
        },
        "Lipad callback reference does not match the resolved transaction.",
      );

      throw new Error(
        `Lipad payout reference '${payoutReference}' does not match transaction '${transaction.id}'.`,
      );
    }

    if (!transaction.provider) {
      this.logger.error(
        {
          provider: "LIPAD",
          transactionId:
            transaction.id,
          publicId:
            transaction.publicId,
        },
        "Lipad callback received for a transaction without an assigned provider.",
      );

      throw new Error(
        `Payment transaction '${transaction.id}' does not have an assigned provider.`,
      );
    }

    if (
      transaction.provider.code
        .trim()
        .toUpperCase() !== "LIPAD"
    ) {
      this.logger.error(
        {
          transactionId:
            transaction.id,
          publicId:
            transaction.publicId,
          assignedProvider:
            transaction.provider.code,
        },
        "Lipad callback does not belong to the assigned provider.",
      );

      throw new Error(
        `Transaction '${transaction.id}' is not assigned to Lipad.`,
      );
    }

    const data =
      this.getCallbackData(
        request.fields.data,
      );

    const paymentStatus =
      this.getPaymentStatus(
        data.payment_status,
      );

    const transactionStatus =
      this.mapPaymentStatus(
        paymentStatus,
      );

    this.logger.info(
      {
        provider: "LIPAD",
        transactionId:
          transaction.id,
        publicId:
          transaction.publicId,
        paymentStatus,
        transactionStatus,
      },
      "Lipad payout callback received.",
    );

    const providerResponse =
      request.fields as Prisma.InputJsonValue;

    try {
      const updatedTransaction =
        await this.repository
          .applyProviderCallback(
            transaction.id,
            transactionStatus,
            providerResponse,
          );

      if (!updatedTransaction) {
        this.logger.info(
          {
            provider: "LIPAD",
            transactionId:
              transaction.id,
            publicId:
              transaction.publicId,
            paymentStatus,
            currentStatus:
              transaction.status,
          },
          "Lipad callback ignored because the transaction is already in a terminal state.",
        );

        return {
          processed: true,
        };
      }

      this.logger.info(
        {
          provider: "LIPAD",
          transactionId:
            updatedTransaction.id,
          publicId:
            updatedTransaction.publicId,
          previousStatus:
            transaction.status,
          status:
            updatedTransaction.status,
          paymentStatus,
        },
        "Lipad payout callback processed successfully.",
      );

      return {
        processed: true,
      };

    } catch (error) {
      this.logger.error(
        {
          provider: "LIPAD",
          transactionId:
            transaction.id,
          publicId:
            transaction.publicId,
          paymentStatus,
          transactionStatus,
          err: error,
        },
        "Failed to process Lipad payout callback.",
      );

      throw error;
    }

    });
  }

  private mapPaymentStatus(
    status: number,
  ): TransactionStatus {
    switch (status) {

      case 700:
        return "SUCCESS";

      case 701:
        return "FAILED";

      case 702:
        return "REVERSED";

      case 703:
      case 704:
        return "PROCESSING";

      default:
        throw new Error(
          `Unsupported Lipad payment status '${status}'.`,
        );
    }
  }


  private getCallbackData(
    value: unknown,
  ): Record<string, unknown> {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new Error(
        "Lipad callback data is invalid.",
      );
    }

    return value as Record<
      string,
      unknown
    >;
  }


  private getPaymentStatus(
    value: unknown,
  ): number {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value)
    ) {
      throw new Error(
        "Lipad callback payment_status is invalid.",
      );
    }

    if (
      ![
        700,
        701,
        702,
        703,
        704,
      ].includes(value)
    ) {
      throw new Error(
        `Unsupported Lipad payment status '${value}'.`,
      );
    }

    return value;
  }


  private requiredString(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      throw new Error(
        `Required Lipad callback field '${field}' is missing.`,
      );
    }

    return value.trim();
  }
}