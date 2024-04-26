import { WithConnection, WithTransaction } from "./Database";
import { UsersRepository } from "./UsersRepository";

export interface IUsersRepository {
  GetById(id: string): Promise<User | undefined>;
  Create(data: { name: string; email: string }): Promise<string>;
}

export type User = {
  id: string;
  name: string;
  email: string;
  created: Date;
  createdBy: string;
  updated: Date;
  updatedBy: string;
  version: number;
};

// top level await
(async () => {
  await WithConnection(async (c) => {
    await WithTransaction(c, async (t) => {
      const instance = new UsersRepository(t);
      const result = await instance.GetById("example");
      console.info(result);
    });
  });
})();
