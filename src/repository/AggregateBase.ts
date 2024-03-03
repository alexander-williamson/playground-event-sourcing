import { IConnection } from "../Database";
import { ILogger } from "../Logger";

export abstract class AggregateBase<T extends { id: string }> {
  constructor(private readonly tableName: string, private readonly logger: ILogger) {}

  public readonly ApplyFunctions: { [key: string]: any } = {};

  protected async GetById(aggregateId: string, connection: IConnection): Promise<T | undefined> {
    const rows = await connection.Query<EventRow>({
      // cannot use variables for table names in mysql
      sql:
        "SELECT id, aggregate_id, event_type, event_data, created_utc " +
        `FROM ${this.tableName} WHERE aggregate_id = ? ORDER BY created_utc, id ASC`,
      values: [aggregateId],
    });

    if (rows.length === 0) {
      return undefined;
    }

    let result = { id: aggregateId } as T;

    // iterate through the events
    for (const row of rows) {
      const fn = this.ApplyFunctions[row.event_type];
      if (fn === undefined) {
        throw new Error(`Unable to find apply function for event: ${row.event_type}`);
      }

      this.logger.debug("Before apply", result);
      result = fn(result, JSON.parse(row.event_data), new Date(row.created_utc));
      this.logger.debug("After apply", result);
    }

    return result;
  }

  protected async InsertEvent(aggregateId: string, eventType: string, eventJson: any, connection: IConnection) {
    console.debug({ aggregateId, eventType, eventJson });
    await connection.Query({
      // mysql does not support variable table names
      sql: `INSERT INTO ${this.tableName} (aggregate_id, event_type, event_data, created_utc) VALUES (?, ?, ?, ?)`,
      values: [aggregateId, eventType, JSON.stringify(eventJson), new Date()],
    });
  }
}

type EventRow = {
  id: string;
  aggregate_id: string;
  event_type: string;
  event_data: string;
  created_utc: string;
};

export type ApplyFn<T> = (aggregate: Partial<T>, data: any, inserted_utc: Date) => void;
