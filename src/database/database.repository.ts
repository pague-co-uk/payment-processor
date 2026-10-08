import {
  DatabaseLifecycle,
  DatabaseOperation,
  getDatabaseLifecycle,
} from "@pague-co-uk/sms-gateway-telemetry";
import { Prisma, PrismaClient } from "@prisma/client";

export interface DatabaseOperationResult<TResult> {
  result: TResult;
  rowsAffected?: number;
}

export abstract class DatabaseRepository {
  protected readonly lifecycle: DatabaseLifecycle;

  protected constructor(
    protected readonly db:
      | PrismaClient
      | Prisma.TransactionClient,
  ) {
    this.lifecycle = getDatabaseLifecycle();
  }

  /**
   * Executes a database operation with telemetry.
   */
  protected execute<TResult>(
    operation: DatabaseOperation,
    table: string,
    query: () => Promise<DatabaseOperationResult<TResult>>,
  ): Promise<TResult> {
    return this.lifecycle.execute(
      {
        system: "mysql",
        operation,
        table,
      },
      query,
    );
  }

  /**
   * Executes a callback within a database transaction.
   * If already executing inside a transaction, the current
   * transaction is reused.
   */
  public withTransaction<TResult>(
    callback: (
      tx: Prisma.TransactionClient,
    ) => Promise<TResult>,
  ): Promise<TResult> {
    if ("$transaction" in this.db) {
      return this.db.$transaction(callback);
    }

    return callback(this.db);
  }

  /**
   * Returns a repository instance bound to the supplied
   * transaction client.
   */
  public abstract withDatabase(
    db: Prisma.TransactionClient,
  ): this;
}