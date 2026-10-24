import type { Product } from "../types/inventory";
import { categories } from "../mock/categories";
import {
  getA5ReceiptCatalogIssue,
  getA5ReceiptColumnSplit,
  getA5ReceiptHeaderExtraMm,
  getA5ReceiptOverflow,
  isA5ChecklistProduct,
  type ProductInventory,
} from "./a5DeliveryReceipt";

export interface IAOA4ReceiptInput {
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  items: {
    productId: string;
    quantity: number;
    unit: string;
    sellingUnitPrice: number;
    lineTotal: number;
  }[];
  grandTotal: number;
}

export interface IAOA4ChecklistItem {
  product: Product;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
}

export interface IAOA4ChecklistGroup {
  category: string;
  items: IAOA4ChecklistItem[];
  subtotal: number | null;
}

export interface IAOA4Checklist {
  columns: IAOA4ChecklistGroup[][];
  unstockedCategorySubtotals: [string, number][];
  unlistedSubtotal: number;
}

const receiptCategoryOrder = [...categories].reverse();

function isPositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

/*
 * Same checklist rules as the main POS A5 receipt: catalog products in POS
 * category order, listed when in stock or part of this order. The printed
 * quantity is the quantity ordered, never stock on hand. Subtotals only sum
 * the order's saved line totals.
 */
export function buildIAOA4Checklist(
  receipt: IAOA4ReceiptInput,
  products: Product[],
  inventory: ProductInventory[],
  isLoading = false,
  loadError: string | null = null
): { checklist: IAOA4Checklist | null; issue: string | null } {
  // Same blocking rules as the POS A5 receipt: loading/missing stock, unsupported categories, overflow.
  const catalogIssue = getA5ReceiptCatalogIssue(products, inventory, isLoading, loadError);
  if (catalogIssue) return { checklist: null, issue: catalogIssue };
  const stockById = new Map(inventory.map((product) => [product.id, product.stock]));
  const categoryById = new Map(products.map((product) => [product.id, product.category]));
  const orderedById = new Map<
    string,
    { quantity: number; unit: string; unitPrice: number }
  >();
  const categorySubtotals = new Map<string, number>();
  let unlistedSubtotal = 0;

  for (const item of receipt.items) {
    if (!isPositive(item.quantity)) continue;
    const previous = orderedById.get(item.productId);
    orderedById.set(item.productId, {
      quantity: (previous?.quantity ?? 0) + item.quantity,
      unit: item.unit,
      unitPrice: item.sellingUnitPrice,
    });
    const category = categoryById.get(item.productId);
    if (category === undefined) {
      if (Number.isFinite(item.lineTotal)) unlistedSubtotal += item.lineTotal;
    } else if (Number.isFinite(item.lineTotal)) {
      categorySubtotals.set(category, (categorySubtotals.get(category) ?? 0) + item.lineTotal);
    }
  }

  const itemsTotal = receipt.items.reduce((total, item) => total + item.lineTotal, 0);
  if (Math.round(itemsTotal * 100) !== Math.round(receipt.grandTotal * 100)) {
    return {
      checklist: null,
      issue: "The saved IAO line totals do not match the order total. Check IAO history before printing the A4 receipt.",
    };
  }

  // Order totals are validated above; the catalog rules come from the POS A5 helpers.

  const groups: IAOA4ChecklistGroup[] = receiptCategoryOrder
    .map((category) => ({
      category,
      items: products
        .filter((product) => product.category === category)
        .filter((product) =>
          isA5ChecklistProduct(stockById.get(product.id), orderedById.get(product.id)?.quantity)
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((product) => {
          const ordered = orderedById.get(product.id);
          return {
            product,
            quantity: ordered?.quantity ?? null,
            unit: ordered?.unit ?? null,
            unitPrice: ordered?.unitPrice ?? null,
          };
        }),
      subtotal: categorySubtotals.get(category) ?? null,
    }))
    .filter((group) => group.items.length > 0);

  const unstockedCategorySubtotals = [...categorySubtotals].filter(
    ([category]) => !groups.some((group) => group.category === category)
  );
  const extraSummaryLines = unstockedCategorySubtotals.length + (unlistedSubtotal > 0 ? 1 : 0);
  const headerExtraMm = getA5ReceiptHeaderExtraMm({
    customerName: receipt.outletName,
    customerAddress: receipt.outletAddress,
    customerPhone: receipt.outletPhone,
  });
  const groupCounts = groups.map((group) => group.items.length);
  const groupHasSubtotal = groups.map((group) => group.subtotal !== null);
  const split = getA5ReceiptColumnSplit(groupCounts, groupHasSubtotal, extraSummaryLines, headerExtraMm);
  if (split === null) {
    const { excessMm } = getA5ReceiptOverflow(groupCounts, groupHasSubtotal, extraSummaryLines, headerExtraMm);
    return {
      checklist: null,
      issue: `The product checklist will not fit on one A4 receipt copy (over by about ${Math.ceil(excessMm)} mm). Use the 80mm Reprint instead.`,
    };
  }

  const columns: IAOA4ChecklistGroup[][] = [[], []];
  let remainingLeft = split.leftItemCount;
  for (const group of groups) {
    const leftCount = Math.min(group.items.length, remainingLeft);
    if (leftCount > 0) {
      columns[0].push({
        ...group,
        items: group.items.slice(0, leftCount),
        subtotal: leftCount === group.items.length ? group.subtotal : null,
      });
    }
    if (leftCount < group.items.length) {
      columns[1].push({ ...group, items: group.items.slice(leftCount) });
    }
    remainingLeft -= leftCount;
  }

  return { checklist: { columns, unstockedCategorySubtotals, unlistedSubtotal }, issue: null };
}
