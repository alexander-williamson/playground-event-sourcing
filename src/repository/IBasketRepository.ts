import { Basket } from "../models/Basket";

export interface IBasketRepository {
  GetById(aggregateId: string): Promise<Basket | undefined>;
  CreateBasket(): Promise<Basket>;
  AddProduct(aggregateId: string, productId: string): Promise<void>;
  RemoveProduct(aggregateId: string, productId: string): Promise<void>;
}
