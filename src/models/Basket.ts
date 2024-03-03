export type Basket = {
  id: string;
  products: { productId: string; amount: number }[];
  created: Date;
  updated: Date;
};
