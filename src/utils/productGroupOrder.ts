import { categories } from "../mock/categories";

const codePrefixCategories: Record<string, string> = {
  "3.6": "3.6 Liters",
  HG: "Half Gallon",
  "1.7": "1.7 Liters",
  "1L": "1 Liter",
  PT: "Pint",
  BC: "Big Cup",
  MC: "Medium Cup",
  MAC: "Medium Cup",
  SC: "Small Cup",
  ICC: "Ice Cream in Cone",
  SPS: "Special Sticks",
  ICB: "Ice Buko",
  LOL: "Ice Lolly",
};

interface GroupableItem {
  id: string;
  code: string;
  name: string;
  category?: string | null;
}

function getGroupIndex(item: GroupableItem) {
  const orderedCategories: readonly string[] = categories;
  const byCategory = item.category
    ? orderedCategories.indexOf(item.category)
    : -1;
  if (byCategory !== -1) return byCategory;

  const prefix = item.code.trim().split("_")[0].toUpperCase();
  const byCode = orderedCategories.indexOf(codePrefixCategories[prefix] ?? "");
  return byCode === -1 ? orderedCategories.length : byCode;
}

/**
 * Returns a sorted copy ordered by product group, then name.
 * The live product (by id) is preferred; otherwise the item's own
 * snapshot code is used to infer the group.
 */
export function sortByProductGroup<T>(
  entries: readonly T[],
  getItem: (entry: T) => GroupableItem,
  liveProducts: readonly { id: string; category: string }[] = []
): T[] {
  const liveById = new Map(liveProducts.map((product) => [product.id, product]));

  return entries
    .map((entry, position) => {
      const item = getItem(entry);
      const live = liveById.get(item.id);
      return {
        entry,
        position,
        name: item.name,
        group: getGroupIndex({
          ...item,
          category: live?.category || item.category,
        }),
      };
    })
    .sort(
      (a, b) =>
        a.group - b.group ||
        a.name.localeCompare(b.name) ||
        a.position - b.position
    )
    .map(({ entry }) => entry);
}
