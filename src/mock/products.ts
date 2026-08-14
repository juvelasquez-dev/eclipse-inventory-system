import type { Product } from "../types/inventory";
import { flavorsByCategory } from "./flavors";

const categoryUnits: Record<string, string> = {
  "3.6 Liters": "Tub",
  "Half Gallon": "Tub",
  "1.7 Liters": "Tub",
  "1 Liter": "Tub",
  Pint: "Tub",

  "Big Cup": "Bag",
  "Medium Cup": "Bag",
  "Small Cup": "Bag",

  "Ice Cream in Cone": "Box",

  "Special Sticks": "Bag",
  "Ice Buko": "Bag",
  "Ice Lolly": "Bag",
};

const categoryCodes: Record<string, string> = {
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
  Apple: "APP",
  Avocara: "AVO",
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
  CoolCumber: "CCU",

  "Fruit Salad": "FS",
  "Fruity Wintermelon": "FW",
  Grapes: "GRP",

  "Halo-Halo": "HH",

  Mango: "MAN",
  "Mango Fiesta": "MF",
  Melon: "MEL",

  "Mallows and Chocolate": "MAC",
  "Mallows and Pistachio": "MAP",

  Milk: "MLK",

  "Nutty Pistachio": "NP",

  Orange: "ORG",

  Pandan: "PAN",
  Pineapple: "PNE",

  "Rocky Road": "RR",

  Strawberry: "STR",
  "Super Strawberry": "SSB",

  Tropix: "TRP",

  Ube: "UBE",
  "Ube With Cheese": "UWC",
  "Ube with Cheese": "UWC",

  Vanilla: "VAN",
};

function generateProductCode(
  category: string,
  flavor: string
): string {
  const categoryCode =
    categoryCodes[category] ?? "CAT";

  const flavorCode =
    flavorCodes[flavor] ??
    flavor
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 3)
      .toUpperCase();

  return `${categoryCode}-${flavorCode}`;
}

function getMinimumStock(
  category: string
): number {
  switch (category) {
    case "3.6 Liters":
      return 10;

    case "Half Gallon":
      return 10;

    case "1.7 Liters":
      return 10;

    case "1 Liter":
      return 15;

    case "Pint":
      return 20;

    case "Big Cup":
    case "Medium Cup":
    case "Small Cup":
      return 20;

    case "Ice Cream in Cone":
      return 10;

    case "Special Sticks":
    case "Ice Buko":
    case "Ice Lolly":
      return 10;

    default:
      return 10;
  }
}

function generateProducts(): Product[] {
  let counter = 1;

  return Object.entries(flavorsByCategory).flatMap(
    ([category, flavors]) =>
      flavors.map((flavor) => {
        const product: Product = {
          id: `P${String(counter).padStart(3, "0")}`,

          code: generateProductCode(
            category,
            flavor
          ),

          name: `${flavor} ${category}`,

          category,

          unit:
            categoryUnits[category] ?? "Unit",

          minimumStock:
            getMinimumStock(category),
        };

        counter++;

        return product;
      })
  );
}

export const products: Product[] =
  generateProducts();