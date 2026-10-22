import { createPortal } from "react-dom";

import type { ReceiptData } from "./DeliveryReceiptPrint";
import type { Product } from "../../types/inventory";
import { useInventory } from "../../hooks/useInventory";
import { resolveReceiptParties } from "../../utils/receiptParties";
import { categories } from "../../mock/categories";
import {
  getA5CategorySubtotals,
  getA5PurchasedQuantities,
  getA5ReceiptColumnSplit,
  getA5ReceiptHeaderExtraMm,
  isA5ChecklistProduct,
  type ProductInventory,
} from "../../utils/a5DeliveryReceipt";

interface A5DeliveryReceiptPrintProps {
  receipt: ReceiptData | null;
  products: Product[];
  inventory: ProductInventory[];
}

interface ChecklistItem {
  product: Product;
  quantity: number | null;
}

interface ChecklistGroup {
  category: string;
  items: ChecklistItem[];
  subtotal: number | null;
}

const receiptCategoryOrder = [...categories].reverse();

function formatAmount(amount: number) {
  return amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatReceiptDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default function A5DeliveryReceiptPrint({
  receipt,
  products,
  inventory,
}: A5DeliveryReceiptPrintProps) {
  const { outlets } = useInventory();
  if (!receipt || typeof document === "undefined") {
    return null;
  }

  const parties = resolveReceiptParties(receipt, outlets);
  const currentProductIds = new Set(products.map((product) => product.id));
  const currentStockById = new Map(
    inventory.map((product) => [product.id, product.stock])
  );
  const purchasedQuantities = getA5PurchasedQuantities(receipt.items);
  const catalogItems: ChecklistItem[] = receiptCategoryOrder.flatMap(
    (category) =>
      products
        .filter((product) => product.category === category)
        .filter((product) =>
          isA5ChecklistProduct(
            currentStockById.get(product.id),
            purchasedQuantities.get(product.id)
          )
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((product) => ({
          product,
          quantity: purchasedQuantities.get(product.id) ?? null,
        }))
  );
  const categorySubtotals = getA5CategorySubtotals(receipt.items, products);

  const catalogGroups: ChecklistGroup[] = receiptCategoryOrder
    .map((category) => ({
      category,
      items: catalogItems.filter((item) => item.product.category === category),
      subtotal: categorySubtotals.get(category) ?? null,
    }))
    .filter((group) => group.items.length > 0);
  const unstockedCategorySubtotals = [...categorySubtotals].filter(
    ([category]) =>
      !catalogGroups.some((group) => group.category === category)
  );

  const unlistedSubtotal = receipt.items.reduce(
    (total, item) =>
      currentProductIds.has(item.product.id)
        ? total
        : total + item.product.price * item.quantity,
    0
  );
  const split = getA5ReceiptColumnSplit(
    catalogGroups.map((group) => group.items.length),
    catalogGroups.map((group) => group.subtotal !== null),
    unstockedCategorySubtotals.length + (unlistedSubtotal > 0 ? 1 : 0),
    getA5ReceiptHeaderExtraMm(receipt, parties)
  );
  const leftItemCount = split?.leftItemCount ?? 0;
  let remainingLeftItems = leftItemCount;
  const columns: ChecklistGroup[][] = [[], []];
  for (const group of catalogGroups) {
    const leftCount = Math.min(group.items.length, remainingLeftItems);
    if (leftCount > 0) {
      columns[0].push({
        ...group,
        items: group.items.slice(0, leftCount),
        subtotal: leftCount === group.items.length ? group.subtotal : null,
      });
    }
    if (leftCount < group.items.length) {
      columns[1].push({
        ...group,
        items: group.items.slice(leftCount),
      });
    }
    remainingLeftItems -= leftCount;
  }
  const isCancelled = receipt.transactionStatus === "CANCELLED";
  const renderCopy = () => (
    <article className="a5-delivery-receipt">
      <header className="a5-dr-header">
        <p className="a5-dr-company">ECLIPSE FOOD TRADING OPC</p>
        <p className="a5-dr-distributor">
          Authorized Distributor of <strong>DAN ERIC&apos;S GRAND ICE CREAM</strong>
        </p>
        <p>Caballero Compound, Lower Balulang, Cagayan de Oro City</p>
        <p>09166979090 | facebook.com/degic10</p>
      </header>

      <section className="a5-dr-identification">
        <div className="a5-dr-customer">
          <p><strong>OUTLET:</strong> {parties.outletName}</p>
          <p><strong>CUSTOMER:</strong> {parties.contactPerson || "-"}</p>
          <p><strong>ADDRESS:</strong> {receipt.customerAddress}</p>
          <p><strong>CONTACT NO.:</strong> {receipt.customerPhone}</p>
        </div>
        <div className="a5-dr-number">
          <div className="a5-dr-number-title">
            <strong>DELIVERY RECEIPT</strong>
            <span>{receipt.deliveryReceiptNumber}</span>
          </div>
          <span><strong>DATE:</strong> {formatReceiptDate(receipt.createdAt)}</span>
        </div>
      </section>

      {isCancelled && (
        <p className="a5-dr-cancelled">CANCELLED — NOT A VALID SALE</p>
      )}

      <div className="a5-dr-divider" />

      <section className="a5-dr-checklist" aria-label="Product checklist">
        {columns.map((column, columnIndex) => (
          <div className="a5-dr-column" key={columnIndex}>
            <div className="a5-dr-column-heading">
              <strong>ITEMS</strong>
              <strong>QTY</strong>
            </div>
            {column.map((group) => (
              <div className="a5-dr-group" key={group.category}>
                {group.items.map(({ product, quantity }) => {
                  const hasQuantity =
                    typeof quantity === "number" &&
                    Number.isFinite(quantity) &&
                    quantity > 0;
                  return (
                    <div className="a5-dr-product-row" key={product.id}>
                      <span className="a5-dr-product-code">{product.code.replace(/_/g, " ")}</span>
                      {hasQuantity && (
                        <span className="a5-dr-quantity">{quantity}</span>
                      )}
                    </div>
                  );
                })}
                {group.subtotal !== null &&
                  Number.isFinite(group.subtotal) &&
                  group.subtotal > 0 && (
                  <div className="a5-dr-group-subtotal">
                    <strong>{formatAmount(group.subtotal)}</strong>
                  </div>
                )}
              </div>
            ))}
            {columnIndex === 1 && (
              <section className="a5-dr-summary">
                {unlistedSubtotal > 0 && (
                  <div className="a5-dr-unlisted">
                    <span>Items no longer in catalog</span>
                    <strong>{formatAmount(unlistedSubtotal)}</strong>
                  </div>
                )}
                {unstockedCategorySubtotals.map(([category, subtotal]) => (
                  <div className="a5-dr-unlisted" key={category}>
                    <span>{category} subtotal</span>
                    <strong>{formatAmount(subtotal)}</strong>
                  </div>
                ))}
                <div className="a5-dr-total">
                  <strong>TOTAL:</strong>
                  <strong>{formatAmount(receipt.subtotal)}</strong>
                </div>
                <div className="a5-dr-payment">
                  <span>{receipt.paymentMethod === "CASH" ? "●" : "○"} CASH</span>
                  <span>{receipt.paymentMethod === "CHEQUE" ? "●" : "○"} CHECK</span>
                  <span>○ FUND TRANSFER</span>
                </div>
              </section>
            )}
          </div>
        ))}
      </section>

      <footer className="a5-dr-footer">
        Items are Received Complete and in Good Condition.
      </footer>
    </article>
  );

  return createPortal(
    <section className="a5-two-copy-sheet" aria-label="Two delivery receipt copies">
      {renderCopy()}
      <div className="a5-dr-cut-guide" aria-hidden="true" />
      {renderCopy()}
    </section>,
    document.body
  );
}
