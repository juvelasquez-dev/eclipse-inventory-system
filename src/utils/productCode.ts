const categoryPrefixes: Record<string, string> = {
  "3.6 Liters": "36",
  "Half Gallon": "HG",
  "1.7 Liters": "17",
  "1 Liter": "1L",
  Pint: "PINT",
  "Big Cup": "BC",
  "Medium Cup": "MC",
  "Small Cup": "SC",
  "Ice Cream in Cone": "CON",
  "Special Sticks": "SS",
  "Ice Buko": "IB",
  "Ice Lolly": "IL",
};

const flavorCodes: Record<string, string> = {
  Avocara: "AVO",
  Apple: "APP",
  Buko: "BUK",

  "Buko Melon": "BM",
  "Buko Pandan": "BP",
  "Buko Strawberry": "BS",
  "Buko Ube": "BU",

  Cheese: "CHE",
  Chocolate: "CHO",

  "Choco Marble": "CM",
  "Choco Malteen": "CMT",
  "Choco Vanilla": "CV",

  Chocofi: "CF",
  Cococheese: "CC",

  "Coffee Mocha Fudge": "CMF",
  "Cookie Cinnamon": "CCN",
  "Cookies N Cream": "CNC",
  "Cookies N Pistachio": "CNP",

  CoolCumber: "CCB",

  "Fruit Salad": "FS",
  "Fruity Wintermelon": "FW",

  Grapes: "GRP",

  "Halo-Halo": "HAL",

  "Mallows and Chocolate": "MAC",
  "Mallows and Pistachio": "MAP",

  Mango: "MAN",
  "Mango Fiesta": "MF",

  Melon: "MEL",
  Milk: "MLK",

  "Nutty Pistachio": "NP",

  Orange: "ORG",
  Pandan: "PAN",
  Pineapple: "PIN",

  "Rocky Road": "RR",

  Strawberry: "STR",
  "Super Strawberry": "SST",

  Tropix: "TRP",

  Ube: "UBE",
  "Ube With Cheese": "UWC",
  "Ube with Cheese": "UWC",

  Vanilla: "VAN",
};

import type { Product } from "../types/inventory";

export function generateProductCode(
  category: string,
  flavor: string
): string {
  const categoryCode =
    categoryPrefixes[category] ?? "PROD";

  const flavorCode =
    flavorCodes[flavor] ??
    flavor
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase();

  return `${categoryCode}-${flavorCode}`;
}

/**
 * Find an existing product by category and flavor.
 * Matches by category and checks if flavor name appears in product name.
 */
export function findExistingProduct(
  category: string,
  flavor: string,
  products: Product[]
): Product | undefined {
  return products.find(
    (product) =>
      product.category === category &&
      product.name
        .toLowerCase()
        .includes(flavor.toLowerCase())
  );
}

/**
 * Derive the code and name format from existing products in a category.
 * This creates a new product code/name for a flavor that doesn't exist yet,
 * using the same format as existing products in that category.
 */
export function deriveProductCodeAndName(
  category: string,
  flavor: string,
  products: Product[]
): { code: string; name: string } {
  const categoryProducts = products.filter(
    (p) => p.category === category
  );

  // If there are existing products in this category, derive format from them
  if (categoryProducts.length > 0) {
    const exampleProduct = categoryProducts[0];
    
    // Extract category prefix from the existing product code
    // E.g., "3.6_MRB" → "3.6", "1L_CH" → "1L", "HG_BM" → "HG"
    const codeParts = exampleProduct.code.split("_");
    const categoryPrefix = codeParts[0];
    const separator = "_";

    // Derive flavor abbreviation (first 3-4 letters, uppercase)
    const flavorAbbrev = flavor
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase();

    const code = `${categoryPrefix}${separator}${flavorAbbrev}`;

    // Derive name format from the existing product
    // Extract the prefix part (e.g., "3.6L" from "3.6L Choco Marble")
    // by removing the flavor from the name
    const exampleName = exampleProduct.name;
    const namePrefix = exampleName.slice(0, exampleName.lastIndexOf(" "));

    const name = `${namePrefix} ${flavor}`;

    return { code, name };
  }

  // Fallback: if no products in category yet, use basic format
  const code = `${category.slice(0, 3).toUpperCase()}_${flavor
    .slice(0, 3)
    .toUpperCase()}`;

  const name = `${category} ${flavor}`;

  return { code, name };
}

