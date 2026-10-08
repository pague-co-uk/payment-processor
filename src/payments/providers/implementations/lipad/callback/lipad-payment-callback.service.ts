import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";

import type {
  PaymentCallbackRequest,
  PaymentCallbackResult,
} from "../../../core/interfaces/payment-provider.adapter.js";

import {
  PaymentProviderRegistry,
} from "../../../core/payment-provider.registry.js";

import {
  PaymentsRepository,
} from "../../../../repositories/payments.repository.js";

@Injectable()
export class LipadPaymentCallbackService {
  private readonly logger:
    ReturnType<typeof getComponentLogger> =
    getComponentLogger(
      "payment-callback-service",
    );

  constructor(
    private readonly repository:
      PaymentsRepository,

    private readonly providers:
      PaymentProviderRegistry,
  ) { }

  public async handle(
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<PaymentCallbackResult> {
    const fields =
      this.toFields(payload);

    const payoutReference =
      this.requiredString(
        fields.payout_reference,
        "payout_reference",
      );

    const transaction =
      await this.repository
        .findTransactionByPublicId(
          payoutReference,
        );

    if (!transaction) {
      this.logger.warn(
        {
          payoutReference,
        },
        "Payment provider callback received for an unknown transaction.",
      );

      throw new Error(
        `Payment transaction with public ID '${payoutReference}' was not found.`,
      );
    }

    if (!transaction.provider) {
      this.logger.error(
        {
          transactionId:
            transaction.id,
          publicId:
            transaction.publicId,
        },
        "Payment provider callback received for a transaction without an assigned provider.",
      );

      throw new Error(
        `Payment transaction '${transaction.id}' does not have an assigned provider.`,
      );
    }

    const providerCode =
      transaction.provider.code;

    const provider =
      this.providers.get(
        providerCode,
      );

    const request:
      PaymentCallbackRequest = {
      fields,
      headers,
      transaction,
    };

    this.logger.info(
      {
        transactionId:
          transaction.id,
        publicId:
          transaction.publicId,
        provider:
          providerCode,
      },
      "Payment provider callback received and routed.",
    );

    return provider.handleCallback(
      request,
    );
  }

  private toFields(
    payload: unknown,
  ): Record<string, unknown> {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new Error(
        "Payment callback payload must be a JSON object.",
      );
    }

    return payload as Record<
      string,
      unknown
    >;
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
        `Payment callback field '${field}' is missing.`,
      );
    }

    return value.trim();
  }
}