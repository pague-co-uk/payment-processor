import { measureOperation } from "@pague-co-uk/sms-gateway-telemetry";
import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
  recordException,
  withPromiseSpan,
} from "@pague-co-uk/sms-gateway-telemetry";

import type {
  PaymentCallbackRequest,
  PaymentCallbackResult,
  PaymentProviderAdapter,
  PaymentRequest,
} from "../../core/interfaces/payment-provider.adapter.js";

import {
  PaymentProvider,
} from "../../core/payment-provider.decorator.js";

import {
  PaymentsRepository,
} from "../../../repositories/payments.repository.js";

import {
  AirtelMoneyClient,
} from "./airtel-money-mw.client.js";

import {
  AirtelMoneyMapper,
} from "./airtel-money-mw.mapper.js";

import type {
  AirtelMoneyPaymentResponse,
} from "./interfaces/airtel-money-api.types.js";


type AirtelMoneyOutcome =
  | "SUCCESS"
  | "FAILED";


const AIRTEL_MONEY_ERROR_CODES = {
  AMBIGUOUS: "DP00800001000",
  SUCCESS: "DP00800001001",
  INCORRECT_PIN: "DP00800001002",
  WITHDRAWAL_LIMIT_EXCEEDED: "DP00800001003",
  INVALID_AMOUNT: "DP00800001004",
  INVALID_TRANSACTION_ID: "DP00800001005",
  IN_PROCESS: "DP00800001006",
  INSUFFICIENT_BALANCE: "DP00800001007",
  REFUSED: "DP00800001008",
  PAYEE_NOT_PERMITTED: "DP00800001010",
  TIMED_OUT: "DP00800001024",
  TRANSACTION_NOT_FOUND: "DP00800001025",
} as const;


@Injectable()
@PaymentProvider("AIRTEL_MONEY_MW")
export class AirtelMoneyProvider
  implements PaymentProviderAdapter<AirtelMoneyPaymentResponse> {

  private readonly logger =
    getComponentLogger("airtel-money-provider");


  constructor(
    private readonly client: AirtelMoneyClient,
    private readonly mapper: AirtelMoneyMapper,
    private readonly repository: PaymentsRepository,
  ) { }


  public async execute(
    request: PaymentRequest,
  ): Promise<AirtelMoneyPaymentResponse> {
    return measureOperation('payments.provider.processing', { provider: 'AIRTEL_MONEY_MW', operation: 'execute' }, async () => {
    const transaction = request.transaction;

    const paymentRequest =
      this.mapper.toPaymentRequest(transaction);

    this.logger.info(
      {
        provider: "AIRTEL_MONEY",
        transactionId: transaction.id,
        publicId: transaction.publicId,
        reference: transaction.reference,
      },
      "Executing Airtel Money payment.",
    );

    try {
      const response =
        await this.client.initiatePayment(paymentRequest);

      this.logger.info(
        {
          provider: "AIRTEL_MONEY",
          transactionId: transaction.id,
          publicId: transaction.publicId,
        },
        "Airtel Money payment request accepted.",
      );

      return response;
    } catch (error) {
      recordException(error);

      this.logger.error(
        {
          provider: "AIRTEL_MONEY",
          transactionId: transaction.id,
          publicId: transaction.publicId,
          err: error,
        },
        "Airtel Money payment execution failed.",
      );

      throw error;
    }

    });
  }


  public async handleCallback(
    request: PaymentCallbackRequest,
  ): Promise<PaymentCallbackResult> {
    return measureOperation('payments.provider.processing', { provider: 'AIRTEL_MONEY_MW', operation: 'handleCallback' }, async () => {
    return withPromiseSpan(
      "AirtelMoneyProvider.handleCallback",
      async (span) => {
        const transaction = request.transaction;

        span.setAttributes({
          "payment.provider": "airtel-money",
          "payment.transaction_id": transaction.id,
          "payment.public_id": transaction.publicId,
        });

        try {
          // 1. Validate the callback structure.

          const airtelTransaction = this.toRecord(
            request.fields.transaction,
            "transaction",
          );

          const callbackPublicId = this.requiredString(
            airtelTransaction.id,
            "transaction.id",
          );

          const callbackStatus = this.requiredString(
            airtelTransaction.status_code,
            "transaction.status_code",
          ).toUpperCase();

          if (callbackPublicId !== transaction.publicId) {
            this.logger.warn(
              {
                transactionId: transaction.id,
                publicId: transaction.publicId,
              },
              "Airtel Money callback reference does not match the transaction.",
            );

            return { processed: false };
          }

          const callbackOutcome =
            this.toCallbackOutcome(callbackStatus);

          if (!callbackOutcome) {
            this.logger.info(
              {
                transactionId: transaction.id,
                publicId: transaction.publicId,
                callbackStatus,
              },
              "Airtel Money callback does not indicate a recognised final outcome.",
            );

            return { processed: false };
          }


          // 2. Handle duplicate callbacks without overwriting terminal states.

          if (this.isTerminalStatus(transaction.status)) {
            const alreadyMatches =
              transaction.status === callbackOutcome;

            if (!alreadyMatches) {
              this.logger.warn(
                {
                  transactionId: transaction.id,
                  publicId: transaction.publicId,
                  currentStatus: transaction.status,
                  callbackOutcome,
                },
                "Airtel Money callback conflicts with the existing terminal transaction status.",
              );
            }

            return { processed: alreadyMatches };
          }


          // 3. Enquire about the actual transaction status at Airtel.

          const paymentRequest =
            this.mapper.toPaymentRequest(transaction);

          let statusResponse:
            | Awaited<ReturnType<AirtelMoneyClient["getPaymentStatus"]>>
            | undefined;

          let providerCode: string | undefined;

          let verifiedOutcome: AirtelMoneyOutcome | null = null;

          try {
            statusResponse = await this.client.getPaymentStatus(
              transaction.publicId,
              paymentRequest.subscriber.country,
              paymentRequest.subscriber.currency,
            );

            providerCode =
              statusResponse.status.response_code ??
              statusResponse.status.result_code ??
              undefined;

            // The API enquiry response and the payment outcome are
            // different things. Inspect the actual transaction status.
            verifiedOutcome = this.toVerifiedOutcome(
              statusResponse.data.transaction.status,
            );

            // Airtel's documented success code explicitly means
            // the transaction succeeded.
            if (
              !verifiedOutcome &&
              providerCode === AIRTEL_MONEY_ERROR_CODES.SUCCESS
            ) {
              verifiedOutcome = "SUCCESS";
            }
          } catch (error) {
            providerCode = this.extractAirtelErrorCode(error);

            if (!providerCode) {
              // A transport or unexpected API failure should propagate
              // so the callback can be retried by the caller.
              throw error;
            }

            verifiedOutcome =
              this.outcomeFromErrorCode(providerCode);

            if (!verifiedOutcome) {
              // Ambiguous, in-process, timed-out, not-found and
              // unknown responses must not finalize the transaction.
              this.logger.info(
                {
                  transactionId: transaction.id,
                  publicId: transaction.publicId,
                  providerCode,
                },
                "Airtel Money enquiry did not establish a final transaction outcome.",
              );

              return { processed: false };
            }
          }


          // 4. Require the callback and the provider enquiry to agree.

          if (
            !verifiedOutcome ||
            verifiedOutcome !== callbackOutcome
          ) {
            this.logger.warn(
              {
                transactionId: transaction.id,
                publicId: transaction.publicId,
                callbackOutcome,
                verifiedOutcome: verifiedOutcome ?? "UNKNOWN",
                providerCode,
              },
              "Airtel Money callback and transaction enquiry outcomes do not agree.",
            );

            return { processed: false };
          }


          // 5. Persist the confirmed result.
          //
          // applyProviderCallback must enforce terminal-state protection
          // atomically in the database.

          const providerResponse = JSON.parse(
            JSON.stringify({
              callback: request.fields,
              statusEnquiry: statusResponse ?? {
                errorCode: providerCode,
              },
            }),
          ) as Parameters<
            PaymentsRepository["applyProviderCallback"]
          >[2];

          await this.repository.applyProviderCallback(
            transaction.id,
            verifiedOutcome,
            providerResponse,
          );

          this.logger.info(
            {
              transactionId: transaction.id,
              publicId: transaction.publicId,
              status: verifiedOutcome,
              providerCode,
            },
            "Airtel Money callback verified and transaction outcome applied.",
          );

          return { processed: true };
        } catch (error) {
          recordException(error);

          this.logger.error(
            {
              transactionId: transaction.id,
              publicId: transaction.publicId,
              err: error,
            },
            "Airtel Money callback processing failed.",
          );

          throw error;
        }
      },
    );

    });
  }


  private toRecord(
    value: unknown,
    field: string,
  ): Record<string, unknown> {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      throw new Error(
        `Airtel Money field '${field}' must be an object.`,
      );
    }

    return value as Record<string, unknown>;
  }


  private requiredString(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      throw new Error(
        `Airtel Money field '${field}' is missing or invalid.`,
      );
    }

    return value.trim();
  }


  private toCallbackOutcome(
    statusCode: string,
  ): AirtelMoneyOutcome | null {
    switch (statusCode) {
      case "TS":
        return "SUCCESS";

      case "TF":
        return "FAILED";

      default:
        return null;
    }
  }


  private toVerifiedOutcome(
    status: unknown,
  ): AirtelMoneyOutcome | null {
    if (typeof status !== "string") {
      return null;
    }

    switch (status.trim().toUpperCase()) {
      case "TS":
      case "SUCCESS":
      case "SUCCESSFUL":
        return "SUCCESS";

      case "TF":
      case "FAILED":
      case "FAILURE":
        return "FAILED";

      default:
        return null;
    }
  }


  private outcomeFromErrorCode(
    code: string,
  ): AirtelMoneyOutcome | null {
    switch (code) {
      case AIRTEL_MONEY_ERROR_CODES.SUCCESS:
        return "SUCCESS";

      case AIRTEL_MONEY_ERROR_CODES.INCORRECT_PIN:
      case AIRTEL_MONEY_ERROR_CODES.WITHDRAWAL_LIMIT_EXCEEDED:
      case AIRTEL_MONEY_ERROR_CODES.INVALID_AMOUNT:
      case AIRTEL_MONEY_ERROR_CODES.INVALID_TRANSACTION_ID:
      case AIRTEL_MONEY_ERROR_CODES.INSUFFICIENT_BALANCE:
      case AIRTEL_MONEY_ERROR_CODES.REFUSED:
      case AIRTEL_MONEY_ERROR_CODES.PAYEE_NOT_PERMITTED:
        return "FAILED";

      case AIRTEL_MONEY_ERROR_CODES.AMBIGUOUS:
      case AIRTEL_MONEY_ERROR_CODES.IN_PROCESS:
      case AIRTEL_MONEY_ERROR_CODES.TIMED_OUT:
      case AIRTEL_MONEY_ERROR_CODES.TRANSACTION_NOT_FOUND:
      default:
        return null;
    }
  }


  private extractAirtelErrorCode(
    error: unknown,
  ): string | undefined {
    if (!error || typeof error !== "object") {
      return undefined;
    }

    const record = error as Record<string, unknown>;

    if (typeof record.providerCode === "string") {
      return record.providerCode;
    }

    const providerResponse = record.providerResponse;

    if (
      providerResponse &&
      typeof providerResponse === "object" &&
      !Array.isArray(providerResponse)
    ) {
      const response = providerResponse as Record<string, unknown>;
      const status = response.status;

      if (
        status &&
        typeof status === "object" &&
        !Array.isArray(status)
      ) {
        const statusRecord = status as Record<string, unknown>;

        if (typeof statusRecord.response_code === "string") {
          return statusRecord.response_code;
        }

        if (typeof statusRecord.result_code === "string") {
          return statusRecord.result_code;
        }
      }
    }

    return undefined;
  }


  private isTerminalStatus(
    status: string,
  ): boolean {
    return (
      status === "SUCCESS" ||
      status === "FAILED" ||
      status === "REVERSED" ||
      status === "CANCELLED"
    );
  }
}