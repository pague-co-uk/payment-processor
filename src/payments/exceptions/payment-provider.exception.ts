import {
  PaymentProcessingException,
} from "./payment-processing.exception.js";

export interface PaymentProviderExceptionOptions {
  readonly retryable?: boolean;
  readonly cause?: unknown;
  readonly providerCode?: string;
  readonly providerMessage?: string;
  readonly providerResponse?: unknown;
}

export class PaymentProviderException
  extends PaymentProcessingException {

  public readonly providerCode?: string;

  public readonly providerMessage?: string;

  public readonly providerResponse?: unknown;

  constructor(
    message: string,
    options?: PaymentProviderExceptionOptions,
  ) {
    super(
      message,
      {
        reason: "PROVIDER_ERROR",
        retryable:
          options?.retryable ?? true,
        cause:
          options?.cause,
      },
    );

    this.name =
      "PaymentProviderException";

    this.providerCode =
      options?.providerCode;

    this.providerMessage =
      options?.providerMessage;

    this.providerResponse =
      options?.providerResponse;
  }
}