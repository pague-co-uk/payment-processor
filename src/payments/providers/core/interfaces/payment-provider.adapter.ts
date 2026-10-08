import type {
  PaymentTransaction,
} from "../../../repositories/payments.repository.js";

export interface PaymentRequest {
  transaction: PaymentTransaction;
}

export interface PaymentCallbackRequest {
  fields: Record<string, unknown>;
  headers: Record<string, string>;
  transaction: PaymentTransaction;
}

export interface PaymentCallbackResult {
  processed: boolean;
}

export interface PaymentProviderAdapter<
  TResult = unknown,
> {
  execute(
    request: PaymentRequest,
  ): Promise<TResult>;

  handleCallback(
    request: PaymentCallbackRequest,
  ): Promise<PaymentCallbackResult>;
}