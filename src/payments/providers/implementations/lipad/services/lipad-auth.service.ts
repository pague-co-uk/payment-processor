import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";

import { AppConfigService } from "../../../../../config/config.service.js";
import { PaymentProviderException } from "../../../../../payments/exceptions/payment-provider.exception.js";


interface LipadAuthResponse {
  access_token: string;
  expiresIn: number;
}


@Injectable()
export class LipadAuthService {
  private readonly logger =
    getComponentLogger(
      "lipad-auth-service",
    );

  private accessToken?: string;

  private expiresAt = 0;

  constructor(
    private readonly config:
      AppConfigService,
  ) { }


  async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      Date.now() < this.expiresAt
    ) {
      return this.accessToken;
    }

    return this.authenticate();
  }


  private async authenticate(): Promise<string> {
    const lipad =
      this.config.lipad;

    let response: Response;

    try {
      response =
        await fetch(
          `${lipad.baseUrl}/v1/auth`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              consumer_key:
                lipad.consumerKey,

              consumer_secret:
                lipad.consumerSecret,
            }),

            signal:
              AbortSignal.timeout(
                lipad.timeoutMs,
              ),
          },
        );
    } catch (error) {
      this.logger.error(
        {
          err: error,
        },
        "Lipad authentication request failed.",
      );

      throw new PaymentProviderException(
        "Lipad authentication request failed.",
        {
          retryable: true,
          cause: error,
        },
      );
    }


    if (!response.ok) {
      const status =
        response.status;

      let responseBody:
        string | undefined;

      try {
        responseBody =
          await response.text();
      } catch (error) {
        this.logger.debug(
          {
            err: error,
            status,
          },
          "Failed to read Lipad authentication error response.",
        );
      }

      this.logger.error(
        {
          status,
          responseBody,
        },
        "Lipad authentication failed.",
      );

      const retryable =
        status >= 500;

      throw new PaymentProviderException(
        `Lipad authentication failed with HTTP ${status}.`,
        {
          retryable,
        },
      );
    }


    let result:
      LipadAuthResponse;

    try {
      result =
        (await response.json()) as
        LipadAuthResponse;
    } catch (error) {
      throw new PaymentProviderException(
        "Lipad authentication response was not valid JSON.",
        {
          retryable: false,
          cause: error,
        },
      );
    }


    if (
      !result.access_token
    ) {
      throw new PaymentProviderException(
        "Lipad authentication response did not contain an access token.",
        {
          retryable: false,
        },
      );
    }


    const expiresInSeconds =
      Number(result.expiresIn);

    if (
      !Number.isFinite(
        expiresInSeconds,
      ) ||
      expiresInSeconds <= 0
    ) {
      throw new PaymentProviderException(
        "Lipad authentication response contained an invalid token expiry.",
        {
          retryable: false,
        },
      );
    }


    this.accessToken =
      result.access_token;

    // Refresh slightly before actual expiry.
    this.expiresAt =
      Date.now() +
      Math.max(
        1,
        expiresInSeconds - 60,
      ) *
      1000;


    this.logger.debug(
      {
        expiresIn:
          expiresInSeconds,
      },
      "Lipad access token acquired.",
    );


    return this.accessToken;
  }
}