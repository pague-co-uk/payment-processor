import {
  PaymentProcessingException,
} from "./payment-processing.exception.js";

export class PaymentValidationException
  extends PaymentProcessingException {

  constructor(
    message: string,
    options?: {
      readonly cause?: unknown;
    },
  ) {
    super(
      message,
      {
        reason: "VALIDATION",
        retryable: false,
        cause: options?.cause,
      },
    );

    this.name = "PaymentValidationException";
  }
}