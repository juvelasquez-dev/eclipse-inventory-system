import type { ReceiptData } from "../components/pos/DeliveryReceiptPrint";
import type { Product } from "../types/inventory";
import { categories } from "../mock/categories";

export type ProductInventory = Product & { stock: number };

const supportedCategories = new Set<string>(categories);
const receiptCategoryOrder = [...categories].reverse();
const checklistRowHeightMm = 3.5;
const checklistGroupSpacingMm = 1.5;
const checklistSubtotalHeightMm = 3.2;
const checklistSummaryLineHeightMm = 3.5;
const checklistHeadingHeightMm = 2.91 + 0.6;
// Measured from the rendered A4 sheet with a one-line-per-field header and no
// cancellation banner: the checklist area is 171.6 mm tall, and the right
// column's total/payment block (12.4 mm) keeps a 45 mm reserved margin below it.
const baseChecklistHeightMm = 171.6;
const summaryBlockHeightMm = 12.45;
const summaryBottomReserveMm = 45;
const fitToleranceMm = 0.4;
const cancelledBannerHeightMm = 4;
const customerLineHeightMm = 2.6;
const customerLineCharacters = 48;

/*
 * The customer block and cancellation banner sit above the checklist, so
 * long wrapped customer text or a cancelled receipt shrinks the checklist area.
 */
export function getA5ReceiptHeaderExtraMm(
  receipt: Pick<
    ReceiptData,
    "customerName" | "customerAddress" | "customerPhone" | "transactionStatus"
  >,
  parties: { outletName: string; contactPerson: string } = {
    outletName: receipt.customerName,
    contactPerson: "",
  }
): number {
  const wrappedLines = [
    `OUTLET: ${parties.outletName}`,
    `CUSTOMER: ${parties.contactPerson || "-"}`,
    `ADDRESS: ${receipt.customerAddress}`,
    `CONTACT NO.: ${receipt.customerPhone}`,
  ].reduce(
    (total, line) =>
      total + Math.max(0, Math.ceil(line.length / customerLineCharacters) - 1),
    0
  );
  // The OUTLET line is one extra line beyond the measured three-field header.
  return (
    (wrappedLines + 1) * customerLineHeightMm +
    (receipt.transactionStatus === "CANCELLED" ? cancelledBannerHeightMm : 0)
  );
}

export function getA5PurchasedQuantities(
  items: ReceiptData["items"]
): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!(Number.isFinite(item.quantity) && item.quantity > 0)) {
      continue;
    }
    quantities.set(
      item.product.id,
      (quantities.get(item.product.id) ?? 0) + item.quantity
    );
  }
  return quantities;
}

/*
 * Category subtotals come only from purchased transaction items (positive,
 * finite quantity and amount). A category without such items gets no entry,
 * so no subtotal row is rendered for it.
 */
export function getA5CategorySubtotals(
  items: ReceiptData["items"],
  products: Product[]
): Map<string, number> {
  const categoryById = new Map(
    products.map((product) => [product.id, product.category])
  );
  const subtotals = new Map<string, number>();
  for (const item of items) {
    const category = categoryById.get(item.product.id);
    const amount = item.product.price * item.quantity;
    if (
      category === undefined ||
      !(Number.isFinite(item.quantity) && item.quantity > 0) ||
      !Number.isFinite(amount)
    ) {
      continue;
    }
    subtotals.set(category, (subtotals.get(category) ?? 0) + amount);
  }
  for (const [category, subtotal] of subtotals) {
    if (!(subtotal > 0)) {
      subtotals.delete(category);
    }
  }
  return subtotals;
}

/*
 * Checkout deducts stock, so a purchased product may already be at zero
 * when the checklist is generated. Purchased products must stay listed so
 * their quantity is printed; unpurchased products need available stock.
 */
export function isA5ChecklistProduct(
  stock: number | undefined,
  purchasedQuantity: number | undefined
): boolean {
  return (stock ?? 0) > 0 || (purchasedQuantity ?? 0) > 0;
}

export interface A5ReceiptColumnSplit {
  leftItemCount: number;
}

/*
 * Available checklist height in each column of one receipt copy. The right
 * column is shorter because the total/payment block sits beneath it.
 */
function getA5ColumnLimits(extraSummaryLines: number, headerExtraMm: number) {
  const left = baseChecklistHeightMm - headerExtraMm - fitToleranceMm;
  const right =
    left -
    summaryBottomReserveMm -
    summaryBlockHeightMm -
    extraSummaryLines * checklistSummaryLineHeightMm;
  return { left, right };
}

/*
 * Estimates how far the checklist exceeds the space available in both
 * columns, so the print warning can say how much has to go.
 */
export function getA5ReceiptOverflow(
  groupCounts: number[],
  groupHasSubtotal: boolean[] = groupCounts.map(() => false),
  extraSummaryLines = 0,
  headerExtraMm = 0
): { excessMm: number; excessRows: number } {
  const limits = getA5ColumnLimits(extraSummaryLines, headerExtraMm);
  const itemCount = groupCounts.reduce((total, count) => total + count, 0);
  const subtotalCount = groupHasSubtotal.filter(Boolean).length;
  const required =
    2 * checklistHeadingHeightMm +
    itemCount * checklistRowHeightMm +
    groupCounts.length * checklistGroupSpacingMm +
    subtotalCount * checklistSubtotalHeightMm;
  const excessMm = Math.max(0, required - (limits.left + limits.right));
  return {
    excessMm,
    excessRows: Math.max(1, Math.ceil(excessMm / checklistRowHeightMm)),
  };
}

function formatA5Overflow(overflow: {
  excessMm: number;
  excessRows: number;
}) {
  return `It exceeds the available space by about ${Math.ceil(
    overflow.excessMm
  )} mm (roughly ${overflow.excessRows} product row${
    overflow.excessRows === 1 ? "" : "s"
  }).`;
}

export function getA5ReceiptColumnSplit(
  groupCounts: number[],
  groupHasSubtotal: boolean[] = groupCounts.map(() => false),
  extraSummaryLines = 0,
  headerExtraMm = 0
): A5ReceiptColumnSplit | null {
  let bestSplit: A5ReceiptColumnSplit | null = null;
  let bestUtilization = Number.POSITIVE_INFINITY;
  const totalItemCount = groupCounts.reduce((total, count) => total + count, 0);
  const {
    left: leftColumnMaxHeightMm,
    right: rightMaxHeight,
  } = getA5ColumnLimits(extraSummaryLines, headerExtraMm);

  for (let leftItemCount = 0; leftItemCount <= totalItemCount; leftItemCount += 1) {
    let itemsLeft = leftItemCount;
    let leftGroupCount = 0;
    let rightGroupCount = 0;
    let leftSubtotalCount = 0;
    let rightSubtotalCount = 0;

    groupCounts.forEach((count, index) => {
      const leftCount = Math.min(count, itemsLeft);
      const rightCount = count - leftCount;
      if (leftCount > 0) {
        leftGroupCount += 1;
        if (leftCount === count && groupHasSubtotal[index]) {
          leftSubtotalCount += 1;
        }
      }
      if (rightCount > 0) {
        rightGroupCount += 1;
        if (groupHasSubtotal[index]) {
          rightSubtotalCount += 1;
        }
      }
      itemsLeft -= leftCount;
    });

    const getHeight = (
      itemCount: number,
      groupCount: number,
      subtotalCount: number
    ) =>
      checklistHeadingHeightMm +
      itemCount * checklistRowHeightMm +
      groupCount * checklistGroupSpacingMm +
      subtotalCount * checklistSubtotalHeightMm;
    const rightItemCount = totalItemCount - leftItemCount;
    // The last left group's bottom margin is empty space above the footer.
    const leftHeight =
      getHeight(leftItemCount, leftGroupCount, leftSubtotalCount) -
      (leftGroupCount > 0 ? checklistGroupSpacingMm : 0);
    const rightHeight = getHeight(
      rightItemCount,
      rightGroupCount,
      rightSubtotalCount
    );
    if (
      leftHeight > leftColumnMaxHeightMm ||
      rightHeight > rightMaxHeight
    ) {
      continue;
    }

    const utilization = Math.max(
      leftHeight / leftColumnMaxHeightMm,
      rightHeight / rightMaxHeight
    );
    if (utilization < bestUtilization) {
      bestSplit = { leftItemCount };
      bestUtilization = utilization;
    }
  }

  return bestSplit;
}

export function getA5ReceiptCatalogIssue(
  products: Product[],
  inventory: ProductInventory[],
  isLoading: boolean,
  loadError: string | null
): string | null {
  if (isLoading) {
    return "The product catalog is still loading. Wait for it to finish before printing the A5 receipt.";
  }
  if (loadError) {
    return "The product catalog could not be loaded. Retry loading it before printing the A5 receipt.";
  }
  if (products.length === 0) {
    return "The product catalog is empty. The A5 checklist cannot be generated.";
  }
  const inventoryById = new Map(
    inventory.map((product) => [product.id, product.stock])
  );
  if (products.some((product) => {
    const stock = inventoryById.get(product.id);
    return stock === undefined || !Number.isFinite(stock);
  })) {
    return "Current inventory quantities are not fully available. Retry loading inventory before printing the A5 checklist.";
  }

  const inStockProducts = products.filter(
    (product) => (inventoryById.get(product.id) ?? 0) > 0
  );

  const uncategorized = inStockProducts.filter(
    (product) => !supportedCategories.has(product.category)
  );
  if (uncategorized.length > 0) {
    const productCodes = uncategorized
      .map((product) => product.code)
      .join(", ");
    return `Assign every catalog product to a supported category before printing the A5 checklist: ${productCodes}.`;
  }

  const groupCounts = receiptCategoryOrder
    .map(
      (category) =>
        inStockProducts.filter((product) => product.category === category).length
    )
    .filter((count) => count > 0);
  if (getA5ReceiptColumnSplit(groupCounts) === null) {
    return `The in-stock product checklist will not fit on one receipt copy (half of the A4 landscape sheet). ${formatA5Overflow(
      getA5ReceiptOverflow(groupCounts)
    )} Reduce the number of products with available stock before printing.`;
  }

  return null;
}

export function getA5ReceiptDataIssue(
  receipt: ReceiptData,
  products?: Product[],
  inventory?: ProductInventory[]
): string | null {
  if (receipt.a5PrintIssue) {
    return receipt.a5PrintIssue;
  }

  const itemsTotal = receipt.items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
  if (Math.round(itemsTotal * 100) !== Math.round(receipt.subtotal * 100)) {
    return "The saved item amounts do not match the saved transaction total. Check POS History before printing.";
  }

  if (products && inventory) {
    const inventoryById = new Map(
      inventory.map((product) => [product.id, product.stock])
    );
    const purchased = getA5PurchasedQuantities(receipt.items);
    const purchasedCategories = new Set(
      getA5CategorySubtotals(receipt.items, products).keys()
    );
    const groups = receiptCategoryOrder
      .map((category) => ({
        category,
        count: products.filter(
          (product) =>
            product.category === category &&
            isA5ChecklistProduct(
              inventoryById.get(product.id),
              purchased.get(product.id)
            )
        ).length,
      }))
      .filter((group) => group.count > 0);
    const groupCategories = new Set<string>(
      groups.map((group) => group.category)
    );
    const unlistedCategories = new Set(
      [...purchasedCategories].filter(
        (category) => !groupCategories.has(category)
      )
    );
    const hasUnlistedItems = receipt.items.some(
      (item) =>
        !products.some((product) => product.id === item.product.id)
    );
    const extraSummaryLines =
      unlistedCategories.size + (hasUnlistedItems ? 1 : 0);
    const headerExtraMm = getA5ReceiptHeaderExtraMm(receipt);
    const groupCounts = groups.map((group) => group.count);
    const groupHasSubtotal = groups.map((group) =>
      purchasedCategories.has(group.category)
    );
    if (
      getA5ReceiptColumnSplit(
        groupCounts,
        groupHasSubtotal,
        extraSummaryLines,
        headerExtraMm
      ) === null
    ) {
      return `The in-stock checklist and transaction subtotals will not fit on one receipt copy (half of the A4 landscape sheet). ${formatA5Overflow(
        getA5ReceiptOverflow(
          groupCounts,
          groupHasSubtotal,
          extraSummaryLines,
          headerExtraMm
        )
      )} Reduce the number of products with available stock before printing.`;
    }
  }

  return null;
}
