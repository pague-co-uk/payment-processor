import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";
import { AppConfigService } from "../../../../../config/config.service.js";
import { PaymentProviderException } from "../../../../../payments/exceptions/payment-provider.exception.js";
import { LipadAuthService } from "../services/lipad-auth.service.js";
import { LipadInternationalPayoutRequest, LipadLocalPayoutRequest, LipadPayoutResponse } from "./interfaces/lipad-api.types.js";

interface LipadErrorResponse {
  payout_reference?: string;
  response_code?: string;
  response_description?: string;
  error_code?: string;
}


@Injectable()
export class LipadPayoutsClient {
  private readonly logger =
    getComponentLogger(
      "lipad-client",
    );


  constructor(
    private readonly config:
      AppConfigService,

    private readonly auth:
      LipadAuthService,
  ) { }


  public async initiateLocalPayout(
    request: LipadLocalPayoutRequest,
  ): Promise<LipadPayoutResponse> {
    const token =
      await this.auth.getAccessToken();

    return this.post(
      "/v1/payouts/initiate",
      {
        "x-access-token":
          token,
      },
      request,
    );
  }


  public async initiateInternationalPayout(
    request: LipadInternationalPayoutRequest,
  ): Promise<LipadPayoutResponse> {
    const token =
      await this.auth.getAccessToken();

    return this.post(
      "/v1/payouts/imt/initiate",
      {
        Authorization:
          token,
      },
      request,
    );
  }




  private async post(
    path: string,
    headers: Record<
      string,
      string
    >,
    request: unknown,
  ): Promise<LipadPayoutResponse> {
    const url =
      `${this.config.lipad.baseUrl}${path}`;

    let response: Response;

    try {
      this.logger.debug(
        {
          path,
          method: "POST",
        },
        "Sending payout request to Lipad.",
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
                this.config.lipad.timeoutMs,
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
        "Lipad payout request failed before receiving a response.",
      );

      throw new PaymentProviderException(
        "Lipad payout request failed before receiving a response.",
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
          ? JSON.parse(
            responseText,
          )
          : undefined;
    } catch (error) {
      this.logger.warn(
        {
          path,
          httpStatus:
            response.status,
          responseBody:
            responseText,
          err: error,
        },
        "Lipad payout response was not valid JSON.",
      );

      body = undefined;
    }


    if (!response.ok) {
      const retryable =
        response.status >= 500 &&
        response.status <= 599;

      const errorResponse =
        this.toErrorResponse(
          body,
        );

      this.logger.error(
        {
          path,
          method: "POST",
          httpStatus:
            response.status,

          payoutReference:
            errorResponse?.payout_reference,

          responseCode:
            errorResponse?.response_code,

          responseDescription:
            errorResponse?.response_description,

          errorCode:
            errorResponse?.error_code,

          retryable,
        },
        "Lipad payout request returned an HTTP error.",
      );

      throw new PaymentProviderException(
        errorResponse?.response_description ??
        `Lipad payout request failed with HTTP ${response.status}.`,
        {
          retryable,

          providerCode:
            errorResponse?.error_code ??
            errorResponse?.response_code,

          providerMessage:
            errorResponse?.response_description,

          providerResponse:
            errorResponse ?? body ?? responseText,
        },
      );
    }


    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      this.logger.error(
        {
          path,
          httpStatus:
            response.status,
          responseBody:
            body ?? responseText,
        },
        "Lipad payout response was invalid.",
      );

      throw new PaymentProviderException(
        "Lipad payout response was invalid.",
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
      "Lipad payout request completed successfully.",
    );


    return body as LipadPayoutResponse;
  }


  private toErrorResponse(
    body: unknown,
  ): LipadErrorResponse | undefined {
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return undefined;
    }

    const value =
      body as Record<
        string,
        unknown
      >;

    return {
      payout_reference:
        this.stringValue(
          value.payout_reference,
        ),

      response_code:
        this.stringValue(
          value.response_code,
        ),

      response_description:
        this.stringValue(
          value.response_description,
        ),

      error_code:
        this.stringValue(
          value.error_code,
        ),
    };
  }


  private stringValue(
    value: unknown,
  ): string | undefined {
    return typeof value === "string" &&
      value.trim() !== ""
      ? value
      : undefined;
  }
}