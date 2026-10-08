import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";

import {
  AirtelMoneyAuthService,
} from "./services/airtel-money-auth.service.js";

import { AppConfigService } from "../../../../config/config.service.js";
import { PaymentProviderException } from "../../../../payments/exceptions/payment-provider.exception.js";
import type {
  AirtelMoneyPaymentRequest,
  AirtelMoneyPaymentResponse,
} from "./interfaces/airtel-money-api.types.js";


@Injectable()
export class AirtelMoneyClient {
  private readonly logger =
    getComponentLogger(
      "airtel-money-client",
    );


  constructor(
    private readonly config:
      AppConfigService,

    private readonly auth:
      AirtelMoneyAuthService,
  ) { }


  public async initiatePayment(
    request: AirtelMoneyPaymentRequest,
  ): Promise<AirtelMoneyPaymentResponse> {
    const token =
      await this.auth.getAccessToken();

    return this.post(
      "/merchant/v1/payments/",
      {
        "X-Country":
          request.subscriber.country,

        "X-Currency":
          request.subscriber.currency,

        Authorization:
          `Bearer ${token}`,
      },
      request,
    );
  }


  private async post(
    path: string,
    headers: Record<string, string>,
    request: unknown,
  ): Promise<AirtelMoneyPaymentResponse> {
    const url =
      `${this.config.airtelMoney.baseUrl}${path}`;

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
              "Content-Type":
                "application/json",

              ...headers,
            },

            body: JSON.stringify(
              request,
            ),

            signal:
              AbortSignal.timeout(
                this.config.airtelMoney.timeoutMs,
              ),
          },
        );

    } catch (error) {
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


    const responseText =
      await response.text();

    let body: unknown;

    try {
      body =
        responseText
          ? JSON.parse(responseText)
          : undefined;

    } catch (error) {
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
      throw new PaymentProviderException(
        "Airtel Money payment response was invalid.",
        {
          retryable: false,
          providerResponse:
            body ?? responseText,
        },
      );
    }


    this.logger.debug(
      {
        path,
        httpStatus:
          response.status,
      },
      "Airtel Money payment request completed successfully.",
    );


    return body as AirtelMoneyPaymentResponse;
  }
}