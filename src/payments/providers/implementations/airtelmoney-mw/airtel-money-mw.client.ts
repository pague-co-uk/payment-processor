import {
  Injectable,
} from "@nestjs/common";

import {
  createCounterMetric,
  createHistogramMetric,
  getComponentLogger,
  withPromiseSpan,
} from "@pague-co-uk/sms-gateway-telemetry";

import {
  AirtelMoneyAuthService,
} from "./services/airtel-money-auth.service.js";

import {
  AppConfigService,
} from "../../../../config/config.service.js";

import {
  PaymentProviderException,
} from "../../../../payments/exceptions/payment-provider.exception.js";

import type {
  AirtelMoneyPaymentRequest,
  AirtelMoneyPaymentResponse,
  AirtelMoneyPaymentStatusResponse,
} from "./interfaces/airtel-money-api.types.js";

/**
 * The subset of Airtel's response structure used to normalize
 * provider errors into the gateway's standard exception fields.
 */
interface AirtelMoneyProviderStatus {
  response_code?: unknown;
  code?: unknown;
  success?: unknown;
  result_code?: unknown;
  message?: unknown;
}

interface AirtelMoneyProviderErrorDetails {
  providerCode?: string;
  providerMessage?: string;
}

/**
 * Safely checks whether a value is a non-null object.
 */
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/**
 * Extracts gateway-standard error details from an Airtel response.
 *
 * Airtel-specific response parsing stays inside this client.
 * Downstream services should consume providerCode, providerMessage,
 * providerResponse and retryable from PaymentProviderException.
 */
function extractProviderError(
  body: unknown,
): AirtelMoneyProviderErrorDetails {
  if (!isRecord(body) || !isRecord(body.status)) {
    return {};
  }

  const status =
    body.status as AirtelMoneyProviderStatus;

  const providerCode =
    typeof status.response_code === "string"
      ? status.response_code
      : typeof status.result_code === "string"
        ? status.result_code
        : typeof status.code === "string"
          ? status.code
          : undefined;

  const providerMessage =
    typeof status.message === "string" &&
      status.message.trim().length > 0
      ? status.message.trim()
      : undefined;

  return {
    providerCode,
    providerMessage,
  };
}

@Injectable()
export class AirtelMoneyClient {
  private readonly logger =
    getComponentLogger(
      "airtel-money-client",
    );

  private readonly paymentRequests =
    createCounterMetric({
      name: "payments.provider.requests",
      description:
        "Airtel Money payment requests.",
    });

  private readonly paymentFailures =
    createCounterMetric({
      name: "payments.provider.failures",
      description:
        "Airtel Money payment request failures.",
    });

  private readonly paymentDuration =
    createHistogramMetric({
      name: "payments.provider.duration",
      description:
        "Airtel Money payment request duration.",
      unit: "ms",
    });

  constructor(
    private readonly config:
      AppConfigService,

    private readonly auth:
      AirtelMoneyAuthService,
  ) { }

  public async initiatePayment(
    request: AirtelMoneyPaymentRequest,
  ): Promise<AirtelMoneyPaymentResponse> {
    return withPromiseSpan(
      "Airtel Money Initiate Payment",
      async (span) => {
        const token =
          await this.auth.getAccessToken();

        span.setAttributes({
          "payment.provider":
            "airtel-money",

          "payment.operation":
            "initiate",

          "payment.country":
            request.subscriber.country,

          "payment.currency":
            request.subscriber.currency,
        });

        return this.post(
          "/merchant/v1/payments/",
          {
            Accept: "*/*",
            "Content-Type":
              "application/json",
            "X-Country":
              request.subscriber.country,
            "X-Currency":
              request.subscriber.currency,
            Authorization:
              `Bearer ${token}`,
          },
          request,
        );
      },
    );
  }

  public async getPaymentStatus(
    transactionId: string,
    country: string,
    currency: string,
  ): Promise<AirtelMoneyPaymentStatusResponse> {
    return withPromiseSpan(
      "Airtel Money Transaction Enquiry",
      async (span) => {
        const token =
          await this.auth.getAccessToken();

        span.setAttributes({
          "payment.provider":
            "airtel-money",

          "payment.operation":
            "status",

          "payment.country":
            country,

          "payment.currency":
            currency,
        });

        return this.get(
          `/standard/v1/payments/${encodeURIComponent(transactionId)}`,
          {
            Accept: "*/*",
            "X-Country": country,
            "X-Currency": currency,
            Authorization:
              `Bearer ${token}`,
          },
        );
      },
    );
  }

  private async post(
    path: string,
    headers: Record<string, string>,
    request: AirtelMoneyPaymentRequest,
  ): Promise<AirtelMoneyPaymentResponse> {
    const url =
      `${this.config.airtelMoney.baseUrl}${path}`;

    const startedAt =
      Date.now();

    this.paymentRequests.increment({
      provider: "airtel-money",
      operation: "initiate",
    });

    let response: Response;

    try {
      this.logger.debug(
        {
          path,
          method: "POST",
        },
        "Sending payment request to Airtel Money.",
      );

      response =
        await fetch(
          url,
          {
            method: "POST",
            headers: {
              ...headers,
            },
            body:
              JSON.stringify(request),
            signal:
              AbortSignal.timeout(
                this.config
                  .airtelMoney
                  .timeoutMs,
              ),
          },
        );
    } catch (error) {
      this.recordFailure(
        "initiate",
        "transport_error",
      );

      this.recordDuration(
        startedAt,
        "initiate",
      );

      this.logger.error(
        {
          path,
          method: "POST",
          err: error,
        },
        "Airtel Money payment request failed before receiving a response.",
      );

      throw new PaymentProviderException(
        "Airtel Money payment request failed before receiving a response.",
        {
          retryable: true,
          cause: error,
        },
      );
    }

    this.recordDuration(
      startedAt,
      "initiate",
    );

    return this.parsePaymentResponse(
      response,
      path,
    );
  }

  private async get(
    path: string,
    headers: Record<string, string>,
  ): Promise<AirtelMoneyPaymentStatusResponse> {
    const url =
      `${this.config.airtelMoney.baseUrl}${path}`;

    const startedAt =
      Date.now();

    this.paymentRequests.increment({
      provider: "airtel-money",
      operation: "status",
    });

    let response: Response;

    try {
      this.logger.debug(
        {
          path,
          method: "GET",
        },
        "Enquiring Airtel Money transaction status.",
      );

      response =
        await fetch(
          url,
          {
            method: "GET",
            headers: {
              ...headers,
            },
            signal:
              AbortSignal.timeout(
                this.config
                  .airtelMoney
                  .timeoutMs,
              ),
          },
        );
    } catch (error) {
      this.recordFailure(
        "status",
        "transport_error",
      );

      this.recordDuration(
        startedAt,
        "status",
      );

      this.logger.error(
        {
          path,
          method: "GET",
          err: error,
        },
        "Airtel Money transaction enquiry failed before receiving a response.",
      );

      throw new PaymentProviderException(
        "Airtel Money transaction enquiry failed before receiving a response.",
        {
          retryable: true,
          cause: error,
        },
      );
    }

    this.recordDuration(
      startedAt,
      "status",
    );

    const responseText =
      await response.text();

    let body: unknown;

    try {
      body =
        responseText
          ? JSON.parse(responseText)
          : undefined;
    } catch (error) {
      /*
       * When the HTTP status already indicates failure,
       * preserve that failure and the raw response.
       * Invalid JSON must not hide the HTTP error.
       */
      if (!response.ok) {
        this.throwHttpError(
          response,
          responseText,
          "status",
          path,
          "GET",
          error,
        );
      }

      this.recordFailure(
        "status",
        "invalid_json",
      );

      this.logger.error(
        {
          path,
          method: "GET",
          httpStatus: response.status,
          err: error,
        },
        "Airtel Money transaction enquiry response was not valid JSON.",
      );

      throw new PaymentProviderException(
        "Airtel Money transaction enquiry response was not valid JSON.",
        {
          retryable: false,
          providerResponse: responseText,
          cause: error,
        },
      );
    }

    if (!response.ok) {
      this.throwHttpError(
        response,
        body ?? responseText,
        "status",
        path,
        "GET",
      );
    }

    if (
      !isRecord(body)
    ) {
      this.recordFailure(
        "status",
        "invalid_response",
      );

      throw new PaymentProviderException(
        "Airtel Money transaction enquiry response was invalid.",
        {
          retryable: false,
          providerResponse:
            body ?? responseText,
        },
      );
    }

    const statusResponse =
      body as unknown as AirtelMoneyPaymentStatusResponse;

    /*
     * status.success describes whether the transaction enquiry
     * API request itself succeeded.
     *
     * It does NOT represent the payment transaction state.
     * The actual transaction state is data.transaction.status.
     */
    if (
      statusResponse.status.success === false
    ) {
      const {
        providerCode,
        providerMessage,
      } = extractProviderError(body);

      this.recordFailure(
        "status",
        "provider_application_error",
      );

      this.logger.warn(
        {
          path,
          method: "GET",
          httpStatus: response.status,
          providerCode,
          providerMessage,
        },
        "Airtel Money transaction enquiry was rejected by the provider.",
      );

      throw new PaymentProviderException(
        providerMessage ??
        "Airtel Money transaction enquiry was rejected by the provider.",
        {
          retryable: false,
          providerCode,
          providerMessage,
          providerResponse: body,
        },
      );
    }

    this.logger.debug(
      {
        path,
        httpStatus: response.status,
        transactionStatus:
          statusResponse
            .data
            .transaction
            .status,
        providerResponseCode:
          statusResponse
            .status
            .response_code,
      },
      "Airtel Money transaction enquiry completed successfully.",
    );

    return statusResponse;
  }

  private async parsePaymentResponse(
    response: Response,
    path: string,
  ): Promise<AirtelMoneyPaymentResponse> {
    const responseText =
      await response.text();

    let body: unknown;

    try {
      body =
        responseText
          ? JSON.parse(responseText)
          : undefined;
    } catch (error) {
      /*
       * If Airtel returned a non-2xx response with a non-JSON body,
       * preserve the HTTP failure and raw body instead of masking
       * it as a JSON parsing failure.
       */
      if (!response.ok) {
        this.throwHttpError(
          response,
          responseText,
          "initiate",
          path,
          "POST",
          error,
        );
      }

      this.recordFailure(
        "initiate",
        "invalid_json",
      );

      this.logger.error(
        {
          path,
          method: "POST",
          httpStatus: response.status,
          err: error,
        },
        "Airtel Money payment response was not valid JSON.",
      );

      throw new PaymentProviderException(
        "Airtel Money payment response was not valid JSON.",
        {
          retryable: false,
          providerResponse: responseText,
          cause: error,
        },
      );
    }

    if (!response.ok) {
      this.throwHttpError(
        response,
        body ?? responseText,
        "initiate",
        path,
        "POST",
      );
    }

    if (
      !isRecord(body)
    ) {
      this.recordFailure(
        "initiate",
        "invalid_response",
      );

      throw new PaymentProviderException(
        "Airtel Money payment response was invalid.",
        {
          retryable: false,
          providerResponse:
            body ?? responseText,
        },
      );
    }

    return body as AirtelMoneyPaymentResponse;
  }

  /**
   * Converts an Airtel HTTP failure into the gateway's standard
   * PaymentProviderException contract.
   *
   * providerCode and providerMessage are extracted here, at the
   * provider boundary. Downstream services do not need to inspect
   * Airtel's response schema.
   */
  private throwHttpError(
    response: Response,
    providerResponse: unknown,
    operation: "initiate" | "status",
    path: string,
    method: "GET" | "POST",
    cause?: unknown,
  ): never {
    const retryable =
      response.status >= 500 &&
      response.status <= 599;

    const {
      providerCode,
      providerMessage,
    } = extractProviderError(providerResponse);

    const message =
      providerMessage ??
      `Airtel Money ${operation === "initiate" ? "payment request" : "transaction enquiry"} failed with HTTP ${response.status}.`;

    this.recordFailure(
      operation,
      retryable
        ? "provider_server_error"
        : "provider_http_error",
    );

    this.logger.error(
      {
        path,
        method,
        httpStatus: response.status,
        providerCode,
        providerMessage,
        retryable,
        ...(cause ? { err: cause } : {}),
      },
      operation === "initiate"
        ? "Airtel Money payment request failed."
        : "Airtel Money transaction enquiry failed.",
    );

    throw new PaymentProviderException(
      message,
      {
        retryable,
        providerCode,
        providerMessage,
        providerResponse,
        ...(cause ? { cause } : {}),
      },
    );
  }

  private recordFailure(
    operation: "initiate" | "status",
    reason: string,
  ): void {
    this.paymentFailures.increment({
      provider: "airtel-money",
      operation,
      reason,
    });
  }

  private recordDuration(
    startedAt: number,
    operation: "initiate" | "status",
  ): void {
    this.paymentDuration.record(
      Date.now() - startedAt,
      {
        provider: "airtel-money",
        operation,
      },
    );
  }
}