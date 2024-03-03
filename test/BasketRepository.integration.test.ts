import { v4 } from "uuid";
import { GetConnection, IConnection } from "../src/Database";
import { IBasketRepository } from "src/repository/IBasketRepository";

describe("BasketAggregate", () => {
  let expectedId: string;

  beforeEach(() => {
    expectedId = v4();
    jest.mock("uuid", () => ({
      v4: () => expectedId,
    }));
    jest.useFakeTimers().setSystemTime(new Date("2020-01-01T03:04:05.678Z"));
    jest.spyOn(console, "debug").mockImplementation();
  });

  it("Can successfully create and retrieve a Basket with several Products", async () => {
    await GetConnection(async (connection) => {
      const instance = GetInstance(connection);
      const { id } = await instance.CreateBasket();
      await instance.AddProduct(id, "first-product-id");
      await instance.AddProduct(id, "second-product-id");
      await instance.AddProduct(id, "second-product-id");

      const result = await instance.GetById(id);

      expect(result).toEqual({
        created: new Date("2020-01-01T03:04:05.678Z"),
        id: expectedId,
        products: [
          { productId: "first-product-id", amount: 1 },
          { productId: "second-product-id", amount: 2 },
        ],
        updated: new Date("2020-01-01T03:04:05.678Z"),
      });
    });
  });

  it("Can successfully add and remove Products", async () => {
    await GetConnection(async (connection) => {
      const instance = GetInstance(connection);
      const { id } = await instance.CreateBasket();
      await instance.AddProduct(id, "first-product-id");
      await instance.RemoveProduct(id, "first-product-id");

      const result = await instance.GetById(id);

      expect(result).toEqual({
        created: new Date("2020-01-01T03:04:05.678Z"),
        id: expectedId,
        products: [],
        updated: new Date("2020-01-01T03:04:05.678Z"),
      });
    });
  });
});

function GetInstance(connection: IConnection): IBasketRepository {
  const { BasketRepository } = require("../src/repository/BasketRepository");
  return new BasketRepository(connection, console);
}

export {};
