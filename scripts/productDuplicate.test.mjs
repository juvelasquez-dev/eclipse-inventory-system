import assert from "node:assert/strict";
import test from "node:test";

import {
  findDuplicateProduct,
  findExistingProduct,
} from "../src/utils/productCode.ts";

const make = (id, code, name, category) => ({
  id,
  code,
  name,
  category,
  unit: "Tub",
  price: 78,
  minimumStock: 20,
});

const products = [
  make("P087", "PT_MAL", "Pint Mallows n Chocolate", "Pint"),
  make("P088", "PT_MG", "Pint Mango", "Pint"),
  make("P089", "PT_MF", "Pint Mango Fiesta", "Pint"),
  make("P093", "PT_UBE", "Pint Ube", "Pint"),
  make("P094", "PT_UC", "Pint Ube w/Cheese", "Pint"),
  make("P128", "ICB_BUKO", "Ice Buko", "Ice Buko"),
  make("P129", "ICB_MEL", "Ice Buko Melon", "Ice Buko"),
  make("P130", "ICB_PND", "Ice Buko Pandan", "Ice Buko"),
];

test("distinct flavors that share a prefix are not duplicates", () => {
  assert.equal(findExistingProduct("Pint", "Mango", products)?.code, "PT_MG");
  assert.equal(findExistingProduct("Pint", "Mango Fiesta", products)?.code, "PT_MF");
  assert.equal(findExistingProduct("Pint", "Ube", products)?.code, "PT_UBE");
  assert.equal(findExistingProduct("Pint", "Ube w/Cheese", products)?.code, "PT_UC");
  assert.equal(findExistingProduct("Ice Buko", "Melon", products)?.code, "ICB_MEL");
});

test("editing each product excludes itself by id", () => {
  assert.equal(findDuplicateProduct("Pint", "Mango", products, "P088")?.code, undefined);
  assert.equal(findDuplicateProduct("Pint", "Ube", products, "P093")?.code, undefined);
  assert.equal(findDuplicateProduct("Ice Buko", "Buko", products, "P128")?.code, undefined);
});

test("editing into another product's identity is still rejected", () => {
  assert.equal(findDuplicateProduct("Pint", "Mango Fiesta", products, "P088")?.code, "PT_MF");
  assert.equal(findDuplicateProduct("Pint", "Ube w/Cheese", products, "P093")?.code, "PT_UC");
  assert.equal(findDuplicateProduct("Ice Buko", "Melon", products, "P128")?.code, "ICB_MEL");
});

test("creating an exact duplicate is still rejected", () => {
  assert.equal(findDuplicateProduct("Pint", "Mango", products)?.code, "PT_MG");
  assert.equal(findDuplicateProduct("Pint", "mango fiesta", products)?.code, "PT_MF");
  assert.equal(findDuplicateProduct("Pint", "Ube w/Cheese", products)?.code, "PT_UC");
  assert.equal(findDuplicateProduct("Ice Buko", "Buko", products)?.code, "ICB_BUKO");
  assert.equal(findDuplicateProduct("Ice Buko", "Melon", products)?.code, "ICB_MEL");
});

test("a generated code that collides with another product is rejected case-insensitively", () => {
  const withLowerCode = [
    ...products,
    make("P200", "pt_ban", "Pint Banana Split", "Pint"),
  ];

  // "Banter" derives PT_BAN, which only differs from pt_ban by case.
  assert.equal(
    findDuplicateProduct("Pint", "Banter", withLowerCode)?.id,
    "P200"
  );
  // Same collision when editing a different product into that flavor.
  assert.equal(
    findDuplicateProduct("Pint", "Banter", withLowerCode, "P088")?.id,
    "P200"
  );
  // The colliding product itself may be edited without self-collision.
  assert.equal(
    findDuplicateProduct("Pint", "Banter", withLowerCode, "P200"),
    undefined
  );
});

test("a genuinely new flavor is allowed", () => {
  assert.equal(findDuplicateProduct("Pint", "Vanilla", products), undefined);
});
