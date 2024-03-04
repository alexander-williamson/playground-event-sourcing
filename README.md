# Playground - Event Sourcing

An example of a bare bones implementation of using a MySQL repository to deal with Event Sourcing aggregates.

I struggled with rehdrating an object bybusing reflection to find althe Apply methods. I also skipped CommandHandlers, but mighr need to introcue them to center the logic for any projections.

The meat of the project is in [AggregateBase](./src/repository/AggregateBase.ts) where we Apply the events back via functions in the Aggregate.

```typescript
// iterate through the events
for (const row of rows) {
  const fn = this.ApplyFunctions[row.event_type];
  if (fn === undefined) {
    throw new Error(`Unable to find apply function for event: ${row.event_type}`);
  }

  result = fn(result, JSON.parse(row.event_data), new Date(row.created_utc));
}
```

We also spit out a Model so the types are clear.

```typescript
export type Basket = {
  id: string;
  products: { productId: string; amount: number }[];
  created: Date;
  updated: Date;
};
```
