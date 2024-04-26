import { IConnection } from "./Database";
import { v4 } from "uuid";
import { User, IUsersRepository } from "./Example";
import { EventSourcingBase, EventSourcingRow } from "./EventSourcingBase";

export class UsersRepository extends EventSourcingBase<User> implements IUsersRepository {
  constructor(private readonly connection: IConnection) {
    super("users_events");
  }

  // repository methods
  async Create(data: { name: string; email: string }): Promise<string> {
    const id = v4();
    await this.InsertEvent(id, "user_created_v1", data, this.connection);
    return id;
  }

  // rehydration / apply functions
  async ApplyUserCreatedV1(event: ApplyUserCreatedV1, instance: User, row: EventSourcingRow): Promise<User> { // we might not chose to pass row
    return {
      ...instance,
      email: event.email,
      name: event.name,
      created: new Date(row.inserted_utc), // you might want to capture this in the event incase the times can be different
      createdBy: row.inserted_by,
      updated: new Date(),
      updatedBy: row.inserted_by,
    };
  }
}

type ApplyUserCreatedV1 = {
  email: string;
  name: string;
};
