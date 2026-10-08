export type PaymentFailureReason =
  | "VALIDATION"
  | "PROVIDER_REJECTION"
  | "PROVIDER_ERROR"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

export interface PaymentProcessingExceptionOptions {
  readonly reason: PaymentFailureReason;
  readonly retryable: boolean;
  readonly cause?: unknown;
}

export class PaymentProcessingException extends Error {
  public readonly reason: PaymentFailureReason;
  public readonly retryable: boolean;

  constructor(
    message: string,
    options: PaymentProcessingExceptionOptions,
  ) {
    super(message, {
      cause: options.cause,
    });

    this.name = "PaymentProcessingException";
    this.reason = options.reason;
    this.retryable = options.retryable;
  }
}