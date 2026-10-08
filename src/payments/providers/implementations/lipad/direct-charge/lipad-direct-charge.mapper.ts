import { Injectable } from "@nestjs/common";



import { PaymentValidationException } from "../../../../../payments/exceptions/payment-validation.exception.js";
import { PaymentTransaction } from "../../../../../payments/repositories/payments.repository.js";
import type {
  LipadDirectChargeRequest,
} from "./interfaces/lipad-direct-charge.types.js";

@Injectable()
export class LipadDirectChargeMapper {
  public toRequest(
    transaction: PaymentTransaction,
  ): LipadDirectChargeRequest {
    const data = this.getData(transaction);

    return {
      external_reference:
        transaction.reference,

      client_code:
        this.requiredString(
          data.clientCode,
          "clientCode",
        ),

      origin_channel_code:
        this.requiredString(
          data.originChannelCode,
          "originChannelCode",
        ),

      originator_msisdn:
        this.requiredString(
          data.originatorMsisdn,
          "originatorMsisdn",
        ),

      payer_msisdn:
        this.requiredString(
          data.payerMsisdn,
          "payerMsisdn",
        ),

      payer_email:
        this.requiredString(
          data.payerEmail,
          "payerEmail",
        ),

      service_code:
        this.requiredString(
          transaction.providerService
            ?.externalServiceCode,
          "providerService.externalServiceCode",
        ),

      account_number:
        this.requiredString(
          data.accountNumber,
          "accountNumber",
        ),

      invoice_number:
        this.requiredString(
          data.invoiceNumber,
          "invoiceNumber",
        ),

      currency_code:
        transaction.currency.code,

      amount:
        transaction.amount.toString(),

      add_transaction_charge:
        this.requiredBoolean(
          data.addTransactionCharge,
          "addTransactionCharge",
        ),

      transaction_charge:
        this.requiredString(
          data.transactionCharge,
          "transactionCharge",
        ),

      payment_method_code:
        this.requiredString(
          data.paymentMethodCode,
          "paymentMethodCode",
        ),

      extra_data:
        this.optionalObject(
          data.extraData,
        ),

      description:
        transaction.description ??
        "Payment",

      notify_client:
        this.requiredBoolean(
          data.notifyClient,
          "notifyClient",
        ),

      notify_originator:
        this.requiredBoolean(
          data.notifyOriginator,
          "notifyOriginator",
        ),

      country_code:
        this.requiredString(
          data.countryCode,
          "countryCode",
        ),

      callback_url:
        this.requiredString(
          data.callbackUrl,
          "callbackUrl",
        ),
    };
  }

  private getData(
    transaction: PaymentTransaction,
  ): Record<string, unknown> {
    if (
      !transaction.metadata ||
      typeof transaction.metadata !== "object" ||
      Array.isArray(transaction.metadata)
    ) {
      throw new PaymentValidationException(
        `Payment transaction '${transaction.id}' does not contain valid direct-charge data.`,
      );
    }

    return transaction.metadata as Record<
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
        `Direct charge field '${field}' is required.`,
      );
    }

    return value.trim();
  }

  private requiredBoolean(
    value: unknown,
    field: string,
  ): boolean {
    if (typeof value !== "boolean") {
      throw new PaymentValidationException(
        `Direct charge field '${field}' must be a boolean.`,
      );
    }

    return value;
  }

  private optionalObject(
    value: unknown,
  ): Record<string, unknown> {
    if (value === undefined || value === null) {
      return {};
    }

    if (
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new PaymentValidationException(
        "Direct charge field 'extraData' must be an object.",
      );
    }

    return value as Record<string, unknown>;
  }
}