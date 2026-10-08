import {
  Injectable,
} from "@nestjs/common";

import { PaymentTransaction } from "src/payments/repositories/payments.repository.js";
import type {
  AirtelMoneyPaymentRequest,
} from "./interfaces/airtel-money-api.types.js";


@Injectable()
export class AirtelMoneyMapper {

  public toPaymentRequest(
    transaction: PaymentTransaction,
  ): AirtelMoneyPaymentRequest {
    const metadata =
      this.getMetadata(
        transaction.metadata,
      );

    const country =
      this.requiredString(
        metadata.country,
        "country",
      );

    const msisdn =
      this.requiredString(
        metadata.msisdn,
        "msisdn",
      );

    return {
      reference:
        transaction.reference,

      subscriber: {
        country,
        currency:
          transaction.currency.code,
        msisdn,
      },

      transaction: {
        amount:
          Number(
            transaction.amount.toString(),
          ),

        country,

        currency:
          transaction.currency.code,

        id:
          transaction.publicId,
      },
    };
  }


  private getMetadata(
    value: unknown,
  ): Record<string, unknown> {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new Error(
        "Airtel Money payment metadata is invalid.",
      );
    }

    return value as Record<
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
        `Required Airtel Money payment field '${field}' is missing.`,
      );
    }

    return value.trim();
  }
}