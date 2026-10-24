import { createPortal } from "react-dom";

import { useInventoryContext } from "../../context/InventoryContext";
import { buildIAOA4Checklist } from "../../utils/iaoA4Receipt";
import { resolveReceiptParties } from "../../utils/receiptParties";

export interface IAOReceiptItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  eclipseReferenceUnitPrice?: number;
  sellingUnitPrice: number;
  lineTotal: number;
}

export interface IAOOutletOrderReceipt {
  receiptNumber: string;
  createdAt: string;
  outletName: string;
  outletAddress: string;
  outletPhone: string;
  items: IAOReceiptItem[];
  grandTotal: number;
  // Present only for orders copied from an Eclipse POS transaction.
  sourceReceipt?: string | null;
  sourceAreaCode?: string | null;
  sourceReceiptYear?: number | null;
  sourceReceiptNumber?: number | null;
}

interface Props {
  receipt: IAOOutletOrderReceipt | null;
}

function formatPrice(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAmount(value: number) {
  return value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function IAOA4Sheet({ receipt }: { receipt: IAOOutletOrderReceipt }) {
  const { products, inventory, outlets, isLoading, loadError } = useInventoryContext();
  const { checklist } = buildIAOA4Checklist(receipt, products, inventory, isLoading, loadError);
  if (!checklist) return null;

  const { columns, unstockedCategorySubtotals, unlistedSubtotal } = checklist;
  const createdAt = new Date(receipt.createdAt);
  const reference = receipt.sourceReceipt ?? receipt.receiptNumber;
  const { contactPerson } = resolveReceiptParties(
    { customerName: receipt.outletName, customerAddress: receipt.outletAddress },
    outlets
  );

  const renderCopy = () => (
    <article className="a5-delivery-receipt iao-a4-copy">
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
          <p><strong>OUTLET:</strong> {receipt.outletName}</p>
          <p><strong>CUSTOMER:</strong> {contactPerson || "-"}</p>
          <p><strong>ADDRESS:</strong> {receipt.outletAddress}</p>
          <p><strong>CONTACT NO.:</strong> {receipt.outletPhone}</p>
        </div>
        <div className="a5-dr-number">
          <div className="a5-dr-number-title">
            <strong>{receipt.sourceReceipt ? "ECLIPSE POS RECEIPT" : "IAO OUTLET ORDER"}</strong>
            <span>{reference}</span>
          </div>
          {receipt.sourceReceipt && <span>IAO ORDER: {receipt.receiptNumber}</span>}
          <span>
            <strong>DATE:</strong>{" "}
            {createdAt.toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" })}{" "}
            {createdAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </section>

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
                {group.items.map(({ product, quantity }) => (
                  <div className="a5-dr-product-row" key={product.id}>
                    <span className="a5-dr-product-code">{product.code.replace(/_/g, " ")}</span>
                    {quantity !== null && <span className="a5-dr-quantity">{quantity}</span>}
                  </div>
                ))}
                {group.subtotal !== null && group.subtotal > 0 && (
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
                  <strong>{formatAmount(receipt.grandTotal)}</strong>
                </div>
              </section>
            )}
          </div>
        ))}
      </section>

      <footer className="a5-dr-footer">
        <p>Thank you for your business!</p>
        <p>This document serves as your IAO outlet order receipt.</p>
      </footer>
    </article>
  );

  return createPortal(
    <section className="a5-two-copy-sheet iao-a4-sheet" aria-label="Two IAO receipt copies">
      {renderCopy()}
      <div className="a5-dr-cut-guide" aria-hidden="true" />
      {renderCopy()}
    </section>,
    document.body
  );
}

export default function IAOOutletOrderReceiptPrint({
  receipt,
}: Props) {
  if (!receipt || typeof document === "undefined") return null;

  return (
    <>
      <IAOThermalReceipt receipt={receipt} />
      <IAOA4Sheet receipt={receipt} />
    </>
  );
}

function IAOThermalReceipt({ receipt }: { receipt: IAOOutletOrderReceipt }) {
  return createPortal(
    <div className="iao-receipt">
      <div className="iao-receipt__header">
        <p className="iao-receipt__brand">ECLIPSE</p>
        <p>Eclipse Food Trading OPC</p>
        <p>Caballero Compound Lower Balulang</p>
        <p>Cagayan De Oro City</p>
      </div>

      <div className="iao-receipt__divider" />

      <div className="iao-receipt__document">
        {receipt.sourceReceipt ? (
          <>
            <p>ECLIPSE POS RECEIPT</p>
            <strong>{receipt.sourceReceipt}</strong>
            <p className="iao-receipt__document-sub">IAO OUTLET ORDER (COPY)</p>
          </>
        ) : (
          <>
            <p>IAO OUTLET ORDER</p>
            <strong>{receipt.receiptNumber}</strong>
          </>
        )}
      </div>

      <div className="iao-receipt__divider" />

      <div className="iao-receipt__details">
        <div><span>Date</span><strong>{new Date(receipt.createdAt).toLocaleDateString("en-PH", { month: "short", day: "2-digit", year: "numeric" })}</strong></div>
        <div><span>Time</span><strong>{new Date(receipt.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</strong></div>
        <div><span>Outlet</span><strong>{receipt.outletName}</strong></div>
        <div><span>Address</span><strong>{receipt.outletAddress}</strong></div>
        <div><span>Phone</span><strong>{receipt.outletPhone}</strong></div>
      </div>

      <div className="iao-receipt__divider" />

      <div className="iao-receipt__items">
        <div className="iao-receipt__item iao-receipt__item--head">
          <span>ITEM</span><span>QTY</span><span>PRICE</span><span>AMOUNT</span>
        </div>
        {receipt.items.map((item) => (
          <div key={item.productId} className="iao-receipt__item">
            <span><strong>{item.productName}</strong><small>{item.productCode}</small></span>
            <span>{item.quantity}</span>
            <span>{formatPrice(item.sellingUnitPrice)}</span>
            <strong>{formatPrice(item.lineTotal)}</strong>
          </div>
        ))}
      </div>

      <div className="iao-receipt__divider" />
      <div className="iao-receipt__total"><span>TOTAL</span><strong>{formatPrice(receipt.grandTotal)}</strong></div>
      <div className="iao-receipt__divider" />

      <div className="iao-receipt__footer">
        <p>Thank you for your business!</p>
        <p>This document serves as your IAO outlet order receipt.</p>
        <p>{receipt.sourceReceipt ?? receipt.receiptNumber}</p>
      </div>
    </div>,
    document.body
  );
}
