import { v4 } from "uuid";
import { IConnection } from "../Database";
import { ILogger } from "../Logger";
import { Basket } from "../models/Basket";
import { AggregateBase } from "./AggregateBase";
import { IBasketRepository } from "./IBasketRepository";

export class BasketRepository extends AggregateBase<Basket> implements IBasketRepository {
  constructor(private readonly connection: IConnection, logger: ILogger) {
    super("basket_events", logger);

    // TODO figure out modern reflection to avoid the need for registration or a case statement
    this.ApplyFunctions["basket_created_v1"] = this.ApplyBasketCreatedV1;
    this.ApplyFunctions["item_added_v1"] = this.ApplyItemAddedV1;
    this.ApplyFunctions["item_removed_v1"] = this.ApplyItemRemovedV1;
  }

  // Fetch

  public GetById(aggregateId: string): Promise<Basket | undefined> {
    return super.GetById(aggregateId, this.connection);
  }

  // Mutate

  public async CreateBasket(): Promise<Basket> {
    const id = v4();
    await this.InsertEvent(id, "basket_created_v1", {}, this.connection);
    const created = await this.GetById(id);
    if (created === undefined) {
      throw new Error("Could not find created basket");
    }
    return created as Basket;
  }

  public async AddProduct(aggregateId: string, productId: string): Promise<void> {
    await this.InsertEvent(aggregateId, "item_added_v1", { productId }, this.connection);
  }

  public async RemoveProduct(aggregateId: string, productId: string): Promise<void> {
    await this.InsertEvent(aggregateId, "item_removed_v1", { productId }, this.connection);
  }

  // Restore

  protected ApplyBasketCreatedV1(before: Basket, _: BasketCreatedV1, inserted: Date): Basket {
    return {
      ...before,
      products: [],
      created: new Date(inserted),
      updated: new Date(inserted),
    };
  }

  protected ApplyItemAddedV1(before: Basket, event: ItemAddedV1, inserted: Date): Basket {
    const item: Basket = { ...before, updated: inserted };
    const products = item.products;
    const existingProduct = products.find((x) => x.productId === event.productId);
    if (existingProduct) {
      existingProduct.amount = existingProduct.amount + 1;
    } else {
      products.push({ productId: event.productId, amount: 1 });
    }
    return { ...item, updated: new Date(inserted) };
  }

  protected ApplyItemRemovedV1(before: Basket, event: ItemRemovedV1, inserted: Date): Basket {
    const item: Basket = { ...before, updated: inserted };
    const existingProduct = item.products.find((x) => x.productId === event.productId);
    if (existingProduct?.amount === 1) {
      const index = item.products.findIndex((x) => x.productId);
      item.products.splice(index, 1); // delete
    } else if (existingProduct) {
      existingProduct.amount = existingProduct.amount - 1;
    } else {
      // do nothing, no product
    }
    return item;
  }
}

// Event type declarations (never change once in database)

type BasketCreatedV1 = {};

type ItemAddedV1 = {
  productId: string;
};

type ItemRemovedV1 = {
  productId: string;
};
