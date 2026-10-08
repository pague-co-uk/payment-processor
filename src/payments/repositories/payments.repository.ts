import {
  Prisma,
  PrismaClient,
  TransactionStatus,
} from "@prisma/client";

import { Inject } from "@nestjs/common/decorators/core/index.js";
import { DATABASE } from "../../database/database.constants.js";
import {
  DatabaseRepository,
} from "../../database/database.repository.js";


// ===========================================================================
// Types
// ===========================================================================

export type PaymentTransaction =
  Prisma.TransactionGetPayload<{
    include: {
      provider: true;
      providerService: true;
      clientService: {
        include: {
          service: true;
        };
      };
      currency: true;
      transactionType: true;
    };
  }>;


// ===========================================================================
// Repository
// ===========================================================================

export class PaymentsRepository
  extends DatabaseRepository {
  constructor(
    @Inject(DATABASE)
    db:
      | PrismaClient
      | Prisma.TransactionClient,
  ) {
    super(db);
  }

  public withDatabase(
    db: Prisma.TransactionClient,
  ): this {
    return new PaymentsRepository(
      db,
    ) as this;
  }

  // ===========================================================================
  // Transaction
  // ===========================================================================

  async findTransactionForProcessing(
    transactionId: string,
  ): Promise<PaymentTransaction | null> {
    return this.execute(
      "SELECT",
      "transactions",
      async () => {
        const result =
          await this.db.transaction.findFirst({
            where: {
              id: transactionId,
              status: "PENDING",
              providerServiceId: null,
            },

            include: {
              provider: true,
              providerService: true,

              clientService: {
                include: {
                  service: true,
                },
              },

              currency: true,
              transactionType: true,
            },
          });

        return {
          result,
        };
      },
    );
  }

  public async markFailed(
    transactionId: string,
    failure: {
      reason: string;
      message: string;
    },
  ): Promise<PaymentTransaction | null> {
    return this.execute(
      "UPDATE",
      "transactions",
      async () => {
        const result =
          await this.db.transaction.updateMany({
            where: {
              id: transactionId,
              status:
                TransactionStatus.PROCESSING,
            },

            data: {
              status:
                TransactionStatus.FAILED,

              providerResponse:
                {
                  failure,
                } as Prisma.InputJsonValue,

              processedAt:
                new Date(),
            },
          });

        if (result.count === 0) {
          return {
            result: null,
            rowsAffected: 0,
          };
        }

        const transaction =
          await this.db.transaction.findUnique({
            where: {
              id: transactionId,
            },

            include: {
              provider: true,
              providerService: true,

              clientService: {
                include: {
                  service: true,
                },
              },

              currency: true,
              transactionType: true,
            },
          });

        return {
          result: transaction,
          rowsAffected: result.count,
        };
      },
    );
  }

  public async findTransactionByPublicId(
    publicId: string,
  ): Promise<PaymentTransaction | null> {
    return this.execute(
      "SELECT",
      "transactions",
      async () => {
        const result =
          await this.db.transaction.findUnique({
            where: {
              publicId,
            },
            include: {
              provider: true,
              providerService: true,

              clientService: {
                include: {
                  service: true,
                },
              },

              currency: true,
              transactionType: true,
            },
          });

        return {
          result,
        };
      },
    );
  }

  // ===========================================================================
  // Provider routing
  // ===========================================================================

  async findActiveProviderServices(
    serviceId: string,
  ) {
    return this.execute(
      "SELECT",
      "provider_services",
      async () => {
        const result =
          await this.db.providerService.findMany({
            where: {
              serviceId,
              active: true,

              provider: {
                status: "ACTIVE",
              },
            },

            include: {
              provider: true,
              service: true,
            },

            orderBy: [
              {
                priority: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
          });

        return {
          result,
        };
      },
    );
  }

  public async assignProvider(
    transactionId: string,
    providerId: string,
    providerServiceId: string,
  ): Promise<PaymentTransaction | null> {
    return this.execute(
      "UPDATE",
      "transactions",
      async () => {
        const result =
          await this.db.transaction.updateMany({
            where: {
              id: transactionId,
              status: "PENDING",
              providerServiceId: null,
            },

            data: {
              providerId,
              providerServiceId,
              status: "PROCESSING",
            },
          });

        if (result.count === 0) {
          return {
            result: null,
            rowsAffected: 0,
          };
        }

        const transaction =
          await this.db.transaction.findUnique({
            where: {
              id: transactionId,
            },

            include: {
              provider: true,
              providerService: true,

              clientService: {
                include: {
                  service: true,
                },
              },

              currency: true,
              transactionType: true,
            },
          });

        return {
          result: transaction,
          rowsAffected: result.count,
        };
      },
    );
  }

  public async findTransactionByReference(
    reference: string,
  ): Promise<PaymentTransaction | null> {
    return this.execute(
      "SELECT",
      "transactions",
      async () => {
        const result =
          await this.db.transaction.findFirst({
            where: {
              reference,
            },

            include: {
              provider: true,
              providerService: true,

              clientService: {
                include: {
                  service: true,
                },
              },

              currency: true,
              transactionType: true,
            },
          });

        return {
          result,
        };
      },
    );
  }

  public async applyProviderCallback(
    transactionId: string,
    status: TransactionStatus,
    providerResponse: Prisma.InputJsonValue,
  ): Promise<PaymentTransaction | null> {
    return this.execute(
      "UPDATE",
      "transactions",
      async () => {
        const result =
          await this.db.transaction.updateMany({
            where: {
              id: transactionId,

              status: {
                notIn: [
                  "SUCCESS",
                  "FAILED",
                  "REVERSED",
                  "CANCELLED",
                ],
              },
            },

            data: {
              status,
              providerResponse,

              ...(status === "SUCCESS" ||
                status === "FAILED" ||
                status === "REVERSED"
                ? {
                  processedAt:
                    new Date(),
                }
                : {}),
            },
          });

        if (result.count === 0) {
          return {
            result: null,
            rowsAffected: 0,
          };
        }

        const transaction =
          await this.db.transaction.findUnique({
            where: {
              id: transactionId,
            },

            include: {
              provider: true,
              providerService: true,

              clientService: {
                include: {
                  service: true,
                },
              },

              currency: true,
              transactionType: true,
            },
          });

        return {
          result: transaction,
          rowsAffected: result.count,
        };
      },
    );
  }
}