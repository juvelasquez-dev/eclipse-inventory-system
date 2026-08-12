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

