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
            Accept:
              "*/*",

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
            Accept:
              "*/*",

            "X-Country":
              country,

            "X-Currency":
              currency,

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
      provider:
        "airtel-money",

      operation:
        "initiate",
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
            method:
              "POST",

            headers: {
              ...headers,
            },

            body:
              JSON.stringify(
                request,
              ),

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
      provider:
        "airtel-money",

      operation:
        "status",
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
            method:
              "GET",

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
          ? JSON.parse(
            responseText,
          )
          : undefined;

    } catch (error) {

      this.recordFailure(
        "status",
        "invalid_json",
      );

      this.logger.error(
        {
          path,
          method: "GET",
          httpStatus:
            response.status,
          err: error,
        },
        "Airtel Money transaction enquiry response was not valid JSON.",
      );

      throw new PaymentProviderException(
        "Airtel Money transaction enquiry response was not valid JSON.",
        {
          retryable: false,
          cause: error,
        },
      );
    }


    if (!response.ok) {

      const retryable =
        response.status >= 500 &&
        response.status <= 599;

      this.recordFailure(
        "status",
        retryable
          ? "provider_server_error"
          : "provider_http_error",
      );

      this.logger.error(
        {
          path,
          method: "GET",
          httpStatus:
            response.status,
          retryable,
        },
        "Airtel Money transaction enquiry returned an HTTP error.",
      );

      throw new PaymentProviderException(
        `Airtel Money transaction enquiry failed with HTTP ${response.status}.`,
        {
          retryable,
          providerResponse:
            body ?? responseText,
        },
      );
    }


    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
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
      body as AirtelMoneyPaymentStatusResponse;


    /*
     * status.success describes whether the
     * transaction enquiry API request itself
     * succeeded.
     *
     * It does NOT represent the payment
     * transaction state.
     *
     * The actual transaction state is:
     *
     * data.transaction.status
     */
    if (
      statusResponse.status.success === false
    ) {

      this.recordFailure(
        "status",
        "provider_application_error",
      );

      this.logger.warn(
        {
          path,
          method: "GET",
          httpStatus:
            response.status,

          providerResponseCode:
            statusResponse
              .status
              .response_code,

          providerResultCode:
            statusResponse
              .status
              .result_code,
        },
        "Airtel Money transaction enquiry was rejected by the provider.",
      );

      throw new PaymentProviderException(
        statusResponse.status.message ||
        "Airtel Money transaction enquiry was rejected by the provider.",
        {
          retryable: false,

          providerCode:
            statusResponse
              .status
              .response_code,

          providerMessage:
            statusResponse
              .status
              .message,

          providerResponse:
            statusResponse,
        },
      );
    }


    this.logger.debug(
      {
        path,
        httpStatus:
          response.status,

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
          ? JSON.parse(
            responseText,
          )
          : undefined;

    } catch (error) {

      this.recordFailure(
        "initiate",
        "invalid_json",
      );

      this.logger.error(
        {
          path,
          method: "POST",
          httpStatus:
            response.status,
          err: error,
        },
        "Airtel Money payment response was not valid JSON.",
      );

      throw new PaymentProviderException(
        "Airtel Money payment response was not valid JSON.",
        {
          retryable: false,
          cause: error,
        },
      );
    }


    if (!response.ok) {

      const retryable =
        response.status >= 500 &&
        response.status <= 599;

      this.recordFailure(
        "initiate",
        retryable
          ? "provider_server_error"
          : "provider_http_error",
      );

      this.logger.error(
        {
          path,
          method: "POST",
          httpStatus:
            response.status,
          retryable,
        },
        "Airtel Money payment request returned an HTTP error.",
      );

      throw new PaymentProviderException(
        `Airtel Money payment request failed with HTTP ${response.status}.`,
        {
          retryable,

          providerResponse:
            body ?? responseText,
        },
      );
    }


    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
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


  private recordFailure(
    operation: "initiate" | "status",
    reason: string,
  ): void {

    this.paymentFailures.increment({
      provider:
        "airtel-money",

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
        provider:
          "airtel-money",

        operation,
      },
    );
  }
}