import mysql from "serverless-mysql";

export interface IConnection {
  Query<T>(options: { sql: string; values?: (string | Date | number)[]; timeout?: number }): Promise<T[]>;
}

export interface ITransaction {
  WithTransaction<T>(fn: () => Promise<T>): Promise<T>;
}

export async function WithConnection<T>(fn: (connection: IConnection) => Promise<T>) {
  const connection = mysql({
    config: {
      host: "127.0.0.1",
      database: "basket",
      user: "basket",
      password: "basket_password",
    },
  });
  const result = await fn({ Query: connection.query });
  connection.quit(); // release the connection
  return result;
}

export async function WithTransaction<T>(connection: IConnection, fn: (connection: IConnection) => Promise<T>) {
  await connection.Query({ sql: "BEGIN TRANSACTION;" });
  try {
    const result = await fn({ Query: connection.Query });
    await connection.Query({ sql: "COMMIT TRANSACTION;" });
    return result;
  } catch (error) {
    await connection.Query({ sql: "ROLLBACK TRANSACTION;" });
  }
}
