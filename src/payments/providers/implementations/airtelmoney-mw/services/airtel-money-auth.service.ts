import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";


import { AppConfigService } from "../../../../../config/config.service.js";
import { PaymentProviderException } from "../../../../../payments/exceptions/payment-provider.exception.js";
import type {
  AirtelMoneyAuthResponse,
} from "../interfaces/airtel-money-api.types.js";


@Injectable()
export class AirtelMoneyAuthService {
  private readonly logger =
    getComponentLogger(
      "airtel-money-auth-service",
    );

  private accessToken?: string;

  private expiresAt = 0;


  constructor(
    private readonly config:
      AppConfigService,
  ) { }


  public async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      Date.now() < this.expiresAt
    ) {
      return this.accessToken;
    }

    return this.authenticate();
  }


  private async authenticate(): Promise<string> {
    const airtel =
      this.config.airtelMoney;

    let response: Response;

    try {
      response =
        await fetch(
          `${airtel.baseUrl}/auth/oauth2/token`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              client_id:
                airtel.clientId,

              client_secret:
                airtel.clientSecret,

              grant_type:
                "client_credentials",
            }),

            signal:
              AbortSignal.timeout(
                airtel.timeoutMs,
              ),
          },
        );

    } catch (error) {
      this.logger.error(
        {
          err: error,
        },
        "Airtel Money authentication request failed.",
      );

      throw new PaymentProviderException(
        "Airtel Money authentication request failed.",
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
        "Airtel Money authentication response was not valid JSON.",
        {
          retryable: false,
          cause: error,
        },
      );
    }


    if (!response.ok) {
      this.logger.error(
        {
          httpStatus:
            response.status,
        },
        "Airtel Money authentication failed.",
      );

      throw new PaymentProviderException(
        `Airtel Money authentication failed with HTTP ${response.status}.`,
        {
          retryable:
            response.status >= 500,
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
        "Airtel Money authentication response was invalid.",
        {
          retryable: false,
          providerResponse:
            body ?? responseText,
        },
      );
    }


    const result =
      body as AirtelMoneyAuthResponse;


    if (
      typeof result.access_token !==
      "string" ||
      result.access_token.trim() === ""
    ) {
      throw new PaymentProviderException(
        "Airtel Money authentication response did not contain an access token.",
        {
          retryable: false,
          providerResponse: body,
        },
      );
    }


    const expiresIn =
      typeof result.expires_in === "number" &&
        Number.isFinite(result.expires_in)
        ? result.expires_in
        : 3600;


    this.accessToken =
      result.access_token;

    this.expiresAt =
      Date.now() +
      Math.max(
        1,
        expiresIn - 60,
      ) * 1000;


    this.logger.debug(
      {
        expiresIn,
      },
      "Airtel Money access token acquired.",
    );


    return this.accessToken;
  }
}