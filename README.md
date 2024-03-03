# Playground - Event Sourcing

An example of a bare bones implementation of using a MySQL repository to deal with Event Sourcing aggregates

In fairness this could be simplified futher with an apply event and a case statement, so this is a blend of a few approaches:

- The future where the apply function handlers don't have to be registered, and the name of the function is found using reflection

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
