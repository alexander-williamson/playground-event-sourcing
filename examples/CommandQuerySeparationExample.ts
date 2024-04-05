// guiding principles
// 1. to think in command / query separation - there are commands and there are queries
// 2. strict CQRS recommends that commands do not return results apart from creation which returns an ID

// Questions for me
// 1. are commands at the app level?
// 2. a clear boundary of domain events vs aggregate root events - Commands that come in are domain commands (CreateTeamCommand)
//    right now we don't emit any events via an internal event bus to update the views like the Greg Young version does (but does not work well with Node)
//    need a discovery into whether an in-mem event bus greg young approach is better (don't think so for node right now)
// 3. we can emit Domain Events from the handlers (like DomainUpdatedV1) if we want to tell other systems of changes
//    either do this by transactional outbox pattern (preferred) or pure sqs publish (good but does not cover sqs failures)

// Useful links
// https://github.com/gregoryyoung/m-r/blob/master/SimpleCQRS/CommandHandlers.cs

interface ICommandHandler<Command, ResultType> {
  // you don't really need this interface but I am enforcing command handler shapes with it
  handle(command: Command): Promise<ResultType>;
}

interface IQueryHandler<TCommand, TResult> {
  // you don't really need this interface but I am enforcing command handler shapes with it
  handle(query: TCommand): Promise<TResult>;
}

class CreateTeamCommandHandler implements ICommandHandler<CreateTeamCommand, string> {
  // this will be called by a middleware/controller/route handler
  // the alternative is this is a function in a service but I would like us to think in commands and queries
  constructor() {}
  async handle(command: CreateTeamCommand): Promise<string> {
    return await WithConnection(async (connection) => {
      const teamsLookupRepository = new TeamsLookupRepository(connection);
      const usersLookupRepository = new UsersLookupRepository(connection);

      const existingTeam = await teamsLookupRepository.findByName(command.name);
      if (existingTeam) {
        throw new Error("A team with that name already exists");
      }

      const owner = await usersLookupRepository.findById(command.ownerId);
      if (!owner) {
        throw new Error("Owner could not be found");
      }

      // this needs to be done in a transaction for consistency of projections
      const id = await WithTransaction(connection, async (transaction) => {
        const teams = new TeamsRepository(transaction);
        const projections = new TeamsProjectionsService(transaction);
        const createdTeamId = await teams.create({
          name: command.name,
          ownerId: command.ownerId,
        });
        const team = await teams.getByIdOrThrow(createdTeamId);
        await projections.update(team, owner.name);
        return createdTeamId;
      });

      return id;
    });
  }
}

export type CreateTeamCommand = {
  name: string;
  ownerId: string;
};

class UpdateTeamNameCommandHandler implements ICommandHandler<UpdateTeamNameCommand, void> {
  // another example of a command handler
  // this time we aren't creating the team, it should already exist
  // note here we have to do a lookup for the owner to update the projections as we'd upsert the value
  constructor() {}
  async handle(command: UpdateTeamNameCommand): Promise<void> {
    await WithConnection(async (connection) => {
      const teamsLookupRepository = new TeamsLookupRepository(connection);
      const usersLookupRepository = new UsersLookupRepository(connection);

      const existingTeam = await teamsLookupRepository.findByName(command.name);
      if (!existingTeam) {
        throw new Error("A team with that id does not exist");
      }

      const owner = await usersLookupRepository.findById(existingTeam.ownerId);
      if (!owner) {
        throw new Error("Owner could not be found");
      }

      // this needs to be done in a transaction for consistency of projections
      await WithTransaction(connection, async (transaction) => {
        const teams = new TeamsRepository(transaction);
        const projections = new TeamsProjectionsService(transaction);
        await teams.setName(existingTeam.id, { name: command.name, updatedById: command.updatedById });
        const updatedTeam = await teams.getByIdOrThrow(existingTeam.id);
        await projections.update(updatedTeam, owner.name);
      });
    });
  }
}

export type UpdateTeamNameCommand = {
  id: string;
  name: string;
  updatedById: string;
};

class FindTeamsQueryHandler implements IQueryHandler<FindTeamsQuery, FindTeamsQueryResults> {
  constructor() {}
  async handle(query: FindTeamsQuery): Promise<FindTeamsQueryResults> {
    const results = await WithConnection(async (connection) => {
      const teamsLookupRepository = new TeamsLookupRepository(connection);
      const searchResults = await teamsLookupRepository.findByOwnerIds(query.ownerIds);
      return searchResults;
    });
    return { results };
  }
}

type FindTeamsQuery = {
  ownerIds: string[];
};

type FindTeamsQueryResults = {
  results: { id: string; name: string; ownerId: string; ownerName: string }[];
};

// repositories

class TeamsRepository {
  constructor(private readonly queryable: IQueryable) {}
  async create(data: { name: string; ownerId: string }): Promise<string> {
    return "team-1";
  }
  async getByIdOrThrow(id: string): Promise<Team> {
    return { id: "team-1", name: "My Team", ownerId: "user-1", version: 1 };
  }
  async setName(aggredateId: string, data: { name: string; updatedById: string }): Promise<void> {}
}

class TeamsLookupRepository {
  constructor(private readonly queryable: IQueryable) {}
  async findByName(name: string): Promise<TeamLookup | undefined> {
    return undefined;
  }
  async findByOwnerIds(ownerIds: string[]): Promise<TeamLookup[]> {
    return [{ id: "team-1", name: "Example Team", ownerId: "user-1", ownerName: "Person Name" }];
  }
}

type TeamLookup = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
};

class TeamsProjectionsService {
  // this could be changed to bring in the usersLookupService so the ownerName does not need to be passed each time
  constructor(private readonly queryable: IQueryable) {}
  async update(team: Team, ownerName: string): Promise<void> {}
}

type Team = {
  id: string;
  name: string;
  ownerId: string;
  version: number;
};

class UsersLookupRepository {
  constructor(private readonly queryable: IQueryable) {}
  async findById(id: string): Promise<UserLookup | undefined> {
    return undefined;
  }
}

type UserLookup = {
  id: string;
  name: string;
  email: string;
};

// database stuff

async function WithConnection<T>(innerFunction: (connection: IQueryable) => Promise<T>): Promise<T> {
  const fakeConnection: IQueryable = {
    query: async () => {},
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTansaction: async () => {},
  };
  return await innerFunction(fakeConnection);
}

async function WithTransaction<T>(queryable: IQueryable, innerFunction: (connection: IQueryable) => Promise<T>): Promise<T> {
  await queryable.beginTransaction();
  try {
    const result = await innerFunction(queryable);
    await queryable.commitTransaction();
    return result;
  } catch (error) {
    await queryable.rollbackTansaction();
    throw error;
  }
}

interface IQueryable {
  query: (args: { sql: string; values?: any[] }) => Promise<any>;
  beginTransaction: () => Promise<void>;
  commitTransaction: () => Promise<void>;
  rollbackTansaction: () => Promise<void>;
}
