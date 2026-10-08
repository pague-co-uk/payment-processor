import {
  Injectable,
} from "@nestjs/common";

import type {
  PaymentTransaction,
} from "../../../../repositories/payments.repository.js";


import type {
  LipadPayoutType,
} from "./interfaces/lipad-payout.types.js";

import { PaymentValidationException } from "../../../../exceptions/payment-validation.exception.js";
import type {
  LipadInternationalPayoutRequest,
  LipadLocalPayoutRequest,
} from "./interfaces/lipad-api.types.js";

@Injectable()
export class LipadPaymentMapper {

  public toLocalPayoutRequest(
    transaction: PaymentTransaction,
  ): LipadLocalPayoutRequest {
    const data =
      this.getData(transaction);

    const destinationType =
      this.destinationType(
        data.destinationType,
      );

    return {
      payout_reference:
        transaction.publicId,

      service_code:
        this.requiredString(
          transaction.providerService
            ?.externalServiceCode,
          "serviceCode",
        ),

      recipient_first_name:
        this.requiredString(
          data.recipientFirstName,
          "recipientFirstName",
        ),

      recipient_last_name:
        this.requiredString(
          data.recipientLastName,
          "recipientLastName",
        ),

      destination_type:
        destinationType,

      destination_name:
        this.requiredString(
          data.destinationName,
          "destinationName",
        ),

      recipient_phone_number:
        this.requiredString(
          data.recipientPhoneNumber,
          "recipientPhoneNumber",
        ),

      recipient_account_number:
        this.requiredString(
          data.recipientAccountNumber,
          "recipientAccountNumber",
        ),

      ...(destinationType === "BANK"
        ? {
          recipient_bank_code:
            this.requiredString(
              data.recipientBankCode,
              "recipientBankCode",
            ),
        }
        : {}),

      recipient_account_name:
        this.requiredString(
          data.recipientAccountName,
          "recipientAccountName",
        ),

      source_currency:
        transaction.currency.code,

      destination_currency:
        this.requiredString(
          data.destinationCurrency,
          "destinationCurrency",
        ),

      exchange_rate:
        this.requiredString(
          data.exchangeRate,
          "exchangeRate",
        ),

      sender_amount:
        transaction.amount.toString(),

      sender_country_code:
        this.requiredString(
          data.senderCountryCode,
          "senderCountryCode",
        ),

      recipient_amount:
        this.requiredString(
          data.recipientAmount,
          "recipientAmount",
        ),

      payment_description:
        transaction.description ??
        "Payment",

      callback_url:
        this.requiredString(
          data.callbackUrl,
          "callbackUrl",
        ),
    };
  }

  public toInternationalPayoutRequest(
    transaction: PaymentTransaction,
  ): LipadInternationalPayoutRequest {
    const data =
      this.getData(transaction);

    const destinationType =
      this.destinationType(
        data.destinationType,
      );

    return {
      payout_reference:
        transaction.reference,

      service_code:
        this.requiredString(
          transaction.providerService
            ?.externalServiceCode,
          "serviceCode",
        ),

      sender_first_name:
        this.requiredString(
          data.senderFirstName,
          "senderFirstName",
        ),

      ...(this.optionalString(
        data.senderMiddleName,
      ) !== undefined
        ? {
          sender_middle_name:
            this.optionalString(
              data.senderMiddleName,
            ),
        }
        : {}),

      sender_last_name:
        this.requiredString(
          data.senderLastName,
          "senderLastName",
        ),

      sender_type:
        this.personType(
          data.senderType,
          "senderType",
        ),

      ...(this.optionalString(
        data.senderDocumentType,
      ) !== undefined
        ? {
          sender_document_type:
            this.optionalString(
              data.senderDocumentType,
            ),
        }
        : {}),

      ...(this.optionalString(
        data.senderDocumentNumber,
      ) !== undefined
        ? {
          sender_document_number:
            this.optionalString(
              data.senderDocumentNumber,
            ),
        }
        : {}),

      sender_country_code:
        this.requiredString(
          data.senderCountryCode,
          "senderCountryCode",
        ),

      ...(this.optionalString(
        data.senderPhoneNumber,
      ) !== undefined
        ? {
          sender_phone_number:
            this.optionalString(
              data.senderPhoneNumber,
            ),
        }
        : {}),

      ...(this.optionalString(
        data.recipientFirstName,
      ) !== undefined
        ? {
          recipient_first_name:
            this.optionalString(
              data.recipientFirstName,
            ),
        }
        : {}),

      ...(this.optionalString(
        data.recipientMiddleName,
      ) !== undefined
        ? {
          recipient_middle_name:
            this.optionalString(
              data.recipientMiddleName,
            ),
        }
        : {}),

      ...(this.optionalString(
        data.recipientLastName,
      ) !== undefined
        ? {
          recipient_last_name:
            this.optionalString(
              data.recipientLastName,
            ),
        }
        : {}),

      recipient_type:
        this.personType(
          data.recipientType,
          "recipientType",
        ),

      ...(this.optionalString(
        data.recipientDocumentType,
      ) !== undefined
        ? {
          recipient_document_type:
            this.optionalString(
              data.recipientDocumentType,
            ),
        }
        : {}),

      ...(this.optionalString(
        data.recipientDocumentNumber,
      ) !== undefined
        ? {
          recipient_document_number:
            this.optionalString(
              data.recipientDocumentNumber,
            ),
        }
        : {}),

      recipient_phone_number:
        this.requiredString(
          data.recipientPhoneNumber,
          "recipientPhoneNumber",
        ),

      recipient_account_number:
        this.requiredString(
          data.recipientAccountNumber,
          "recipientAccountNumber",
        ),

      recipient_account_name:
        this.requiredString(
          data.recipientAccountName,
          "recipientAccountName",
        ),

      recipient_occupation:
        this.requiredString(
          data.recipientOccupation,
          "recipientOccupation",
        ),

      destination_type:
        destinationType,

      destination_name:
        this.requiredString(
          data.destinationName,
          "destinationName",
        ),

      ...(destinationType === "BANK"
        ? {
          recipient_bank_code:
            this.requiredString(
              data.recipientBankCode,
              "recipientBankCode",
            ),
        }
        : {}),

      source_currency:
        transaction.currency.code,

      destination_currency:
        this.requiredString(
          data.destinationCurrency,
          "destinationCurrency",
        ),

      income_source:
        this.requiredString(
          data.incomeSource,
          "incomeSource",
        ),

      fund_purpose:
        this.requiredString(
          data.fundPurpose,
          "fundPurpose",
        ),

      exchange_rate:
        this.requiredString(
          data.exchangeRate,
          "exchangeRate",
        ),

      sender_amount:
        transaction.amount.toString(),

      recipient_amount:
        this.requiredString(
          data.recipientAmount,
          "recipientAmount",
        ),

      payment_description:
        transaction.description ??
        "Payment",

      ...(this.optionalString(
        data.callbackUrl,
      ) !== undefined
        ? {
          callback_url:
            this.optionalString(
              data.callbackUrl,
            ),
        }
        : {}),
    };
  }

  public getPayoutType(
    transaction: PaymentTransaction,
  ): LipadPayoutType {
    const data =
      this.getData(transaction);

    const type =
      this.requiredString(
        data.type,
        "type",
      ).toLowerCase();

    if (
      type !== "local" &&
      type !== "international"
    ) {
      throw new PaymentValidationException(
        `Unsupported Lipad payout type '${type}'. Expected 'local' or 'international'.`,
      );
    }

    return type;
  }

  private getData(
    transaction: PaymentTransaction,
  ): Record<string, unknown> {
    const metadata =
      transaction.metadata;

    if (
      !metadata ||
      typeof metadata !== "object" ||
      Array.isArray(metadata)
    ) {
      throw new PaymentValidationException(
        `Transaction '${transaction.id}' does not contain valid payment metadata.`,
      );
    }

    return metadata as Record<
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
      throw new PaymentValidationException(
        `Required Lipad payout field '${field}' is missing.`,
      );
    }

    return value.trim();
  }

  private optionalString(
    value: unknown,
  ): string | undefined {
    if (
      value === undefined ||
      value === null
    ) {
      return undefined;
    }

    if (
      typeof value !== "string"
    ) {
      throw new PaymentValidationException(
        "Optional Lipad payout field must be a string.",
      );
    }

    const valueString =
      value.trim();

    return valueString === ""
      ? undefined
      : valueString;
  }

  private destinationType(
    value: unknown,
  ): "MOBILE" | "BANK" {
    const normalized =
      this.requiredString(
        value,
        "destinationType",
      ).toUpperCase();

    if (
      normalized !== "MOBILE" &&
      normalized !== "BANK"
    ) {
      throw new PaymentValidationException(
        `Unsupported Lipad destination type '${normalized}'. Expected 'MOBILE' or 'BANK'.`,
      );
    }

    return normalized;
  }

  private personType(
    value: unknown,
    field: string,
  ): "INDIVIDUAL" | "COMPANY" {
    const normalized =
      this.requiredString(
        value,
        field,
      ).toUpperCase();

    if (
      normalized !== "INDIVIDUAL" &&
      normalized !== "COMPANY"
    ) {
      throw new PaymentValidationException(
        `Unsupported Lipad ${field} '${normalized}'. Expected 'INDIVIDUAL' or 'COMPANY'.`,
      );
    }

    return normalized;
  }
}