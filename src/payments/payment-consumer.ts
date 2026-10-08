import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import {
  QueueProcessingError,
} from "@pague-co-uk/sms-gateway-queue-client";

import type {
  QueueClient,
} from "@pague-co-uk/sms-gateway-queue-client";

import {
  getComponentLogger,
  recordException,
  withSpan,
} from "@pague-co-uk/sms-gateway-telemetry";

import {
  AppConfigService,
} from "../config/config.service.js";

import {
  QUEUE_CLIENT,
} from "../queue/constants/queue.constants.js";

import {
  PaymentProcessingService,
} from "./services/payment-processing.service.js";


// ===========================================================================
// Types
// ===========================================================================

interface PaymentMessage {
  transactionId: string;
}


// ===========================================================================
// Consumer
// ===========================================================================

@Injectable()
export class PaymentConsumer
  implements OnModuleInit, OnModuleDestroy {

  private readonly logger =
    getComponentLogger(
      PaymentConsumer.name,
    );

  private running = false;

  constructor(
    @Inject(QUEUE_CLIENT)
    private readonly queue:
      QueueClient,

    private readonly config:
      AppConfigService,

    private readonly processing:
      PaymentProcessingService,
  ) { }


  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  public async onModuleInit(): Promise<void> {
    this.running = true;

    this.logger.info(
      {
        queue:
          this.config.payment.consumerQueue,

        prefetch:
          this.config.rabbitmq.consumerPrefetch,
      },
      "Payment consumer starting.",
    );

    // -------------------------------------------------------------------------
    // RabbitMQ connection
    // -------------------------------------------------------------------------

    try {
      await this.queue.connect();

      this.logger.info(
        {
          queue:
            this.config.payment.consumerQueue,

          queueClientState:
            this.queue.currentState,
        },
        "Payment consumer connected to RabbitMQ.",
      );
    } catch (error) {
      recordException(error);

      this.logger.error(
        {
          queue:
            this.config.payment.consumerQueue,

          err: error,
        },
        "Payment consumer failed to connect to RabbitMQ.",
      );

      throw error;
    }

    // -------------------------------------------------------------------------
    // Consumption
    // -------------------------------------------------------------------------

    try {
      await this.startConsumption();
    } catch (error) {
      recordException(error);

      this.logger.error(
        {
          queue:
            this.config.payment.consumerQueue,

          err: error,
        },
        "Payment consumer failed to bind to RabbitMQ queue.",
      );

      throw error;
    }

    this.logger.info(
      {
        queue:
          this.config.payment.consumerQueue,

        prefetch:
          this.config.rabbitmq.consumerPrefetch,
      },
      "Payment consumer started successfully.",
    );
  }


  public async onModuleDestroy(): Promise<void> {
    this.running = false;

    this.logger.info(
      {
        queue:
          this.config.payment.consumerQueue,
      },
      "Payment consumer stopping.",
    );

    this.logger.info(
      "Payment consumer stopped.",
    );
  }


  // ===========================================================================
  // RabbitMQ consumption
  // ===========================================================================

  private async startConsumption(): Promise<void> {
    const queue =
      this.config.payment.consumerQueue;

    this.logger.info(
      {
        queue,

        prefetch:
          this.config.rabbitmq.consumerPrefetch,

        queueClientState:
          this.queue.currentState,
      },
      "Starting RabbitMQ subscription for payment consumer.",
    );

    const consumer =
      await this.queue.subscribe<PaymentMessage>(
        queue,

        async (message) => {
          this.logger.info(
            {
              queue,

              transactionId:
                message.transactionId,
            },
            "RabbitMQ delivered payment message to consumer.",
          );

          if (!this.running) {
            this.logger.warn(
              {
                queue,

                transactionId:
                  message.transactionId,
              },
              "Payment consumer received message while shutting down.",
            );

            throw new QueueProcessingError(
              "Payment consumer is shutting down.",
              {
                requeue: true,
              },
            );
          }

          try {
            await this.handleMessage(
              message,
            );

            this.logger.info(
              {
                queue,

                transactionId:
                  message.transactionId,
              },
              "Payment consumer message handler completed.",
            );
          } catch (error) {
            /*
             * QueueProcessingError is intentional. It contains the queue
             * disposition selected by the payment-processing layer.
             *
             * Do not replace it with a generic Error and do not swallow it.
             * ManagedQueue must receive it so that it can ACK or requeue
             * according to error.requeue.
             */
            if (
              error instanceof
              QueueProcessingError
            ) {
              this.logger.warn(
                {
                  queue,

                  transactionId:
                    message.transactionId,

                  requeue:
                    error.requeue,

                  err: error,
                },
                "Payment message processing completed with an explicit queue disposition.",
              );

              throw error;
            }

            /*
             * Unexpected errors have no explicit queue disposition.
             * Let the queue client handle them according to its default
             * failure/requeue behaviour.
             */
            recordException(error);

            this.logger.error(
              {
                queue,

                transactionId:
                  message.transactionId,

                err: error,
              },
              "Payment consumer message handler failed unexpectedly.",
            );

            throw error;
          }
        },
      );

    this.logger.info(
      {
        queue,

        consumerTag:
          consumer.consumerTag,
      },
      "Successfully bound payment consumer to RabbitMQ queue.",
    );
  }


  // ===========================================================================
  // Message handling
  // ===========================================================================

  private async handleMessage(
    message: PaymentMessage,
  ): Promise<void> {
    await withSpan(
      "PaymentConsumer.handleMessage",
      async (span) => {
        span.setAttributes({
          "payment.transaction_id":
            message.transactionId,
        });

        if (
          typeof message.transactionId !==
          "string" ||
          message.transactionId.trim() === ""
        ) {
          const error =
            new Error(
              "Payment message does not contain a valid transaction ID.",
            );

          recordException(error);

          throw new QueueProcessingError(
            error.message,
            {
              requeue: false,
              cause: error,
            },
          );
        }

        this.logger.info(
          {
            transactionId:
              message.transactionId,
          },
          "Processing payment transaction.",
        );

        await this.processing.process(
          message.transactionId,
        );

        this.logger.info(
          {
            transactionId:
              message.transactionId,
          },
          "Payment transaction processing completed.",
        );
      },
    );
  }
}