import { IConnection } from "./Database";

export abstract class EventSourcingBase<T extends Entity> {
  constructor(private readonly tableName: string) {}

  public async GetById(aggregateId: string): Promise<T | undefined> {
    const rows = await this.GetRows(aggregateId);
    if(rows.length === 0) { 
      return undefined;
    }
    return await this.ApplyEventRows(rows);
  }

  protected async InsertEvent(aggregateId: string, eventType: string, eventJson: any, connection: IConnection): Promise<void> {
    console.debug({ aggregateId, eventType, eventJson });
    await connection.Query({
      // mysql does not support variable table names
      sql: `INSERT INTO ${this.tableName} (aggregate_id, event_type, event_data, created_utc) VALUES (?, ?, ?, ?)`,
      values: [aggregateId, eventType, JSON.stringify(eventJson), new Date()],
    });
  }

  private async GetRows(aggregateId: string): Promise<EventSourcingRow[]> {
    // some example rows
    const results: EventSourcingRow[] = [
      {
        aggregate_id: "example",
        event_data: JSON.stringify({ email: "alex@example.com", name: "Alex" }),
        event_type: "user_created_v1",
        id: 1,
        inserted_by: "b02f90a9-7413-4bfe-bb46-3dc59d535e2d",
        inserted_utc: new Date(),
      },
    ];
    return Promise.resolve(results);
  }

  private async ApplyEventRows(rows: EventSourcingRow[]): Promise<T> {
    let instance: Partial<T> = {};
    instance.id = rows[0].aggregate_id;
    for (const row of rows) {
      const fnName = EventSourcingBase.BuildApplyFunctionName(row.event_type);
      if (typeof (this as any)[fnName] !== "function") {
        const subclassName = (this as any).constructor.name;
        throw new Error(`Unable to find function ${fnName} in ${subclassName}`);
      }
      const parsed = JSON.parse(row.event_data);
      instance = await (this as any)[fnName](parsed, instance, row);
    }
    return instance as T;
  }

  private static BuildApplyFunctionName(eventType: string): string {
    return `Apply${EventSourcingBase.ConvertToCamelCase(eventType)}`;
  }

  private static ConvertToCamelCase(input: string): string {
    const split = input.split("_");
    let word = "";
    split.forEach((w) => (word += w.substring(0, 1).toUpperCase() + w.substring(1, w.length)));
    return word;
  }
}

export type EventSourcingRow = {
  id: number;
  aggregate_id: string;
  event_type: string;
  event_data: string;
  inserted_utc: Date;
  inserted_by: string;
};

export type Entity = {
  id: string;
  version: number;
};
