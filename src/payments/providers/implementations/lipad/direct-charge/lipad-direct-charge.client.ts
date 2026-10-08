import { Injectable } from "@nestjs/common";
import { getComponentLogger } from "@pague-co-uk/sms-gateway-telemetry";


import { LipadAuthService } from "../services/lipad-auth.service.js";

import { AppConfigService } from "../../../../../config/config.service.js";
import { PaymentProviderException } from "../../../../../payments/exceptions/payment-provider.exception.js";
import type {
  LipadDirectChargeOtpRequest,
  LipadDirectChargeOtpResponse,
  LipadDirectChargeRequest,
  LipadDirectChargeResponse,
  LipadDirectChargeStatusResponse,
} from "./interfaces/lipad-direct-charge.types.js";

interface LipadErrorResponse {
  response_code?: string;
  response_description?: string;
  error_code?: string;
  external_reference?: string;
  charge_request_id?: string | number;
}

@Injectable()
export class LipadDirectChargeClient {
  private readonly logger =
    getComponentLogger("lipad-direct-charge-client");

  constructor(
    private readonly config: AppConfigService,
    private readonly auth: LipadAuthService,
  ) { }

  /**
   * Initiates a Lipad mobile-money direct charge.
   */
  public async initiate(
    request: LipadDirectChargeRequest,
  ): Promise<LipadDirectChargeResponse> {
    const token = await this.auth.getAccessToken();

    return this.post<LipadDirectChargeResponse>(
      "/v1/mobile-money/charge",
      {
        "x-access-token": token,
      },
      request,
    );
  }

  /**
   * Verifies an OTP for a direct-charge request.
   */
  public async verifyOtp(
    request: LipadDirectChargeOtpRequest,
  ): Promise<LipadDirectChargeOtpResponse> {
    const token = await this.auth.getAccessToken();

    return this.post<LipadDirectChargeOtpResponse>(
      "/v1/mobile-money/verify-otp",
      {
        "x-access-token": token,
      },
      request,
    );
  }

  /**
   * Retrieves the current status of a direct-charge transaction.
   */
  public async getStatus(
    chargeRequestId: string | number,
  ): Promise<LipadDirectChargeStatusResponse> {
    const token = await this.auth.getAccessToken();

    return this.get<LipadDirectChargeStatusResponse>(
      `/v1/transaction/${encodeURIComponent(String(chargeRequestId))}/status`,
      {
        "x-access-token": token,
      },
    );
  }

  private async post<TResponse>(
    path: string,
    headers: Record<string, string>,
    request: unknown,
  ): Promise<TResponse> {
    const url = `${this.config.lipad.baseUrl}${path}`;

    let response: Response;

    try {
      this.logger.debug(
        {
          path,
          method: "POST",
        },
        "Sending Lipad direct charge request.",
      );

      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.config.lipad.timeoutMs),
      });
    } catch (error) {
      this.logger.error(
        {
          path,
          method: "POST",
          err: error,
        },
        "Lipad direct charge request failed before receiving a response.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge request failed before receiving a response.",
        {
          retryable: true,
          cause: error,
        },
      );
    }

    return this.handleResponse<TResponse>(
      response,
      path,
      "POST",
    );
  }

  private async get<TResponse>(
    path: string,
    headers: Record<string, string>,
  ): Promise<TResponse> {
    const url = `${this.config.lipad.baseUrl}${path}`;

    let response: Response;

    try {
      this.logger.debug(
        {
          path,
          method: "GET",
        },
        "Sending Lipad direct charge status request.",
      );

      response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        signal: AbortSignal.timeout(this.config.lipad.timeoutMs),
      });
    } catch (error) {
      this.logger.error(
        {
          path,
          method: "GET",
          err: error,
        },
        "Lipad direct charge status request failed before receiving a response.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge status request failed before receiving a response.",
        {
          retryable: true,
          cause: error,
        },
      );
    }

    return this.handleResponse<TResponse>(
      response,
      path,
      "GET",
    );
  }

  private async handleResponse<TResponse>(
    response: Response,
    path: string,
    method: string,
  ): Promise<TResponse> {
    const responseText = await response.text();

    let body: unknown;

    try {
      body = responseText
        ? JSON.parse(responseText)
        : undefined;
    } catch (error) {
      this.logger.warn(
        {
          path,
          method,
          httpStatus: response.status,
          responseBody: responseText,
          err: error,
        },
        "Lipad direct charge response was not valid JSON.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge response was not valid JSON.",
        {
          retryable: false,
          cause: error,
        },
      );
    }

    if (!response.ok) {
      const errorResponse =
        this.toErrorResponse(body);

      const retryable =
        response.status >= 500 &&
        response.status <= 599;

      this.logger.error(
        {
          path,
          method,
          httpStatus: response.status,
          responseCode:
            errorResponse?.response_code,
          responseDescription:
            errorResponse?.response_description,
          errorCode:
            errorResponse?.error_code,
          externalReference:
            errorResponse?.external_reference,
          chargeRequestId:
            errorResponse?.charge_request_id,
          retryable,
        },
        "Lipad direct charge request returned an HTTP error.",
      );

      throw new PaymentProviderException(
        errorResponse?.response_description ??
        `Lipad direct charge request failed with HTTP ${response.status}.`,
        {
          retryable,
          providerCode:
            errorResponse?.error_code ??
            errorResponse?.response_code,
          providerMessage:
            errorResponse?.response_description,
          providerResponse:
            errorResponse ??
            body ??
            responseText,
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
          method,
          httpStatus: response.status,
          responseBody:
            body ?? responseText,
        },
        "Lipad direct charge response was invalid.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge response was invalid.",
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
        method,
        httpStatus: response.status,
      },
      "Lipad direct charge request completed successfully.",
    );

    return body as TResponse;
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
      body as Record<string, unknown>;

    return {
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

      external_reference:
        this.stringValue(
          value.external_reference,
        ),

      charge_request_id:
        typeof value.charge_request_id ===
          "string" ||
          typeof value.charge_request_id ===
          "number"
          ? value.charge_request_id
          : undefined,
    };
  }

  private stringValue(
    value: unknown,
  ): string | undefined {
    return (
      typeof value === "string" &&
      value.trim() !== ""
    )
      ? value
      : undefined;
  }

  public async verifyDirectChargeOtp(
    reference: string,
    otp: string,
  ): Promise<LipadDirectChargeOtpResponse> {
    const token =
      await this.auth.getAccessToken();

    return this.postDirectChargeOtp(
      "/v1/mobile-money/verify-otp",
      {
        "x-access-token":
          token,
      },
      {
        reference,
        otp,
      },
    );
  }


  private async postDirectChargeOtp(
    path: string,
    headers: Record<
      string,
      string
    >,
    request: {
      reference: string;
      otp: string;
    },
  ): Promise<LipadDirectChargeOtpResponse> {
    const url =
      `${this.config.lipad.baseUrl}${path}`;

    let response: Response;

    try {
      this.logger.debug(
        {
          path,
          method: "POST",
          reference:
            request.reference,
        },
        "Sending direct charge OTP verification request to Lipad.",
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
          reference:
            request.reference,
          err: error,
        },
        "Lipad direct charge OTP verification failed before receiving a response.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge OTP verification failed before receiving a response.",
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
          err: error,
        },
        "Lipad direct charge OTP response was not valid JSON.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge OTP response was not valid JSON.",
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
          reference:
            request.reference,
          retryable,
        },
        "Lipad direct charge OTP verification returned an HTTP error.",
      );

      throw new PaymentProviderException(
        `Lipad direct charge OTP verification failed with HTTP ${response.status}.`,
        {
          retryable,
          providerResponse:
            body,
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
          reference:
            request.reference,
        },
        "Lipad direct charge OTP response was invalid.",
      );

      throw new PaymentProviderException(
        "Lipad direct charge OTP response was invalid.",
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
        reference:
          request.reference,
      },
      "Lipad direct charge OTP verification completed successfully.",
    );


    return body as LipadDirectChargeOtpResponse;
  }

}