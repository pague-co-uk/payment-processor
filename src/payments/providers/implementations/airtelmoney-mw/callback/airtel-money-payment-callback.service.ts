import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getComponentLogger } from "@pague-co-uk/sms-gateway-telemetry";
import { PaymentsRepository } from "../../../../repositories/payments.repository.js";
import type {
  PaymentCallbackRequest,
  PaymentCallbackResult,
} from "../../../core/interfaces/payment-provider.adapter.js";
import { PaymentProviderRegistry } from "../../../core/payment-provider.registry.js";

const AIRTEL_MONEY_PROVIDER_CODE = "AIRTEL_MONEY_MW";

@Injectable()
export class AirtelMoneyPaymentCallbackService {
  private readonly logger = getComponentLogger(
    "airtel-money-payment-callback-service",
  );

  constructor(
    private readonly repository: PaymentsRepository,
    private readonly providers: PaymentProviderRegistry,
  ) { }

  public async handle(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<PaymentCallbackResult> {
    const fields = this.toFields(payload);
    const airtelTransaction = this.toFields(fields.transaction);

    const publicId = this.requiredString(
      airtelTransaction.id,
      "transaction.id",
    );

    const transaction =
      await this.repository.findTransactionByPublicId(publicId);

    if (!transaction) {
      this.logger.warn(
        { publicId },
        "Airtel Money callback received for an unknown transaction.",
      );

      throw new NotFoundException(
        "Payment transaction was not found.",
      );
    }

    if (!transaction.provider) {
      this.logger.error(
        {
          transactionId: transaction.id,
          publicId: transaction.publicId,
        },
        "Airtel Money callback received for a transaction without an assigned provider.",
      );

      throw new ConflictException(
        "Payment transaction does not have an assigned provider.",
      );
    }

    if (transaction.provider.code !== AIRTEL_MONEY_PROVIDER_CODE) {
      this.logger.warn(
        {
          transactionId: transaction.id,
          publicId: transaction.publicId,
          assignedProvider: transaction.provider.code,
        },
        "Airtel Money callback received for a transaction assigned to another provider.",
      );

      throw new ConflictException(
        "Transaction is not assigned to Airtel Money.",
      );
    }

    const provider = this.providers.get(transaction.provider.code);

    const request: PaymentCallbackRequest = {
      fields,
      headers,
      transaction,
    };

    this.logger.info(
      {
        transactionId: transaction.id,
        publicId: transaction.publicId,
        provider: transaction.provider.code,
      },
      "Airtel Money callback received and routed to its provider adapter.",
    );

    return provider.handleCallback(request);
  }

  private toFields(value: unknown): Record<string, unknown> {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new BadRequestException(
        "Airtel Money callback payload must contain valid JSON objects.",
      );
    }

    return value as Record<string, unknown>;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim() === "") {
      throw new BadRequestException(
        `Airtel Money callback field '${field}' is missing.`,
      );
    }

    return value.trim();
  }
}