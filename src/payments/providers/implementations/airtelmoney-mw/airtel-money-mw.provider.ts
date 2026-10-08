import {
  Injectable,
} from "@nestjs/common";

import {
  getComponentLogger,
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


import { AirtelMoneyClient } from "./airtel-money-mw.client.js";
import { AirtelMoneyMapper } from "./airtel-money-mw.mapper.js";
import type {
  AirtelMoneyPaymentResponse,
} from "./interfaces/airtel-money-api.types.js";


@Injectable()
@PaymentProvider("AIRTEL_MONEY_MW")
export class AirtelMoneyProvider
  implements PaymentProviderAdapter<AirtelMoneyPaymentResponse> {
  private readonly logger =
    getComponentLogger(
      "airtel-money-provider",
    );


  constructor(
    private readonly client:
      AirtelMoneyClient,

    private readonly mapper:
      AirtelMoneyMapper,
  ) { }


  public async execute(
    request: PaymentRequest,
  ): Promise<AirtelMoneyPaymentResponse> {
    const transaction =
      request.transaction;

    const paymentRequest =
      this.mapper.toPaymentRequest(
        transaction,
      );

    this.logger.info(
      {
        provider:
          "AIRTEL_MONEY",

        transactionId:
          transaction.id,

        publicId:
          transaction.publicId,

        reference:
          transaction.reference,
      },
      "Executing Airtel Money payment.",
    );

    try {
      const response =
        await this.client
          .initiatePayment(
            paymentRequest,
          );

      this.logger.info(
        {
          provider:
            "AIRTEL_MONEY",

          transactionId:
            transaction.id,

          publicId:
            transaction.publicId,
        },
        "Airtel Money payment request accepted.",
      );

      return response;

    } catch (error) {
      this.logger.error(
        {
          provider:
            "AIRTEL_MONEY",

          transactionId:
            transaction.id,

          publicId:
            transaction.publicId,

          err: error,
        },
        "Airtel Money payment execution failed.",
      );

      throw error;
    }
  }


  public async handleCallback(
    _request: PaymentCallbackRequest,
  ): Promise<PaymentCallbackResult> {
    throw new Error(
      "Airtel Money callback handling has not been implemented.",
    );
  }
}