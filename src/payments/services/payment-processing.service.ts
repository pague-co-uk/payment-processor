import {
  Injectable,
} from "@nestjs/common";

import {
  QueueProcessingError,
} from "@pague-co-uk/sms-gateway-queue-client";

import {
  getComponentLogger,
} from "@pague-co-uk/sms-gateway-telemetry";

import type {
  PaymentRequest,
} from "../providers/core/interfaces/payment-provider.adapter.js";

import {
  PaymentProviderRegistry,
} from "../providers/core/payment-provider.registry.js";

import {
  PaymentsRepository,
} from "../repositories/payments.repository.js";

import { PaymentProcessingException } from "../exceptions/payment-processing.exception.js";
import {
  PaymentRoutingService,
} from "./payment-routing.service.js";


@Injectable()
export class PaymentProcessingService {
  private readonly logger:
    ReturnType<typeof getComponentLogger> =
    getComponentLogger(
      "payment-processing-service",
    );

  constructor(
    private readonly repository:
      PaymentsRepository,

    private readonly routing:
      PaymentRoutingService,

    private readonly providers:
      PaymentProviderRegistry,
  ) { }

  public async process(
    transactionId: string,
  ): Promise<unknown> {
    const transaction =
      await this.repository
        .findTransactionForProcessing(
          transactionId,
        );

    if (!transaction) {
      throw new Error(
        `Payment transaction '${transactionId}' is not available for processing.`,
      );
    }

    const providerService =
      await this.routing.resolve(
        transaction.clientService.serviceId,
      );

    const assignedTransaction =
      await this.repository.assignProvider(
        transaction.id,
        providerService.providerId,
        providerService.id,
      );

    if (!assignedTransaction) {
      this.logger.info(
        {
          transactionId:
            transaction.id,
        },
        "Payment transaction was already claimed for processing.",
      );

      return {
        processed: false,
      };
    }

    const provider =
      this.providers.get(
        providerService.provider.code,
      );

    const request:
      PaymentRequest = {
      transaction:
        assignedTransaction,
    };

    try {
      return await provider.execute(
        request,
      );
    } catch (error) {
      if (
        error instanceof
        PaymentProcessingException
      ) {
        this.logger.error(
          {
            transactionId:
              transaction.id,

            publicId:
              transaction.publicId,

            provider:
              providerService.provider.code,

            reason:
              error.reason,

            retryable:
              error.retryable,

            err:
              error,
          },
          "Payment processing failed.",
        );

        if (!error.retryable) {
          await this.repository.markFailed(
            transaction.id, {
            reason: error.reason,
            message: error.message
          }
          );
        }

        throw new QueueProcessingError(
          error.message,
          {
            requeue:
              error.retryable,

            cause:
              error,
          },
        );
      }

      throw error;
    }
  }

}