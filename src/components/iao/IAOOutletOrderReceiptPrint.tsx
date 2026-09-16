import { createPortal } from "react-dom";

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

export default function IAOOutletOrderReceiptPrint({
  receipt,
}: Props) {
  if (!receipt || typeof document === "undefined") return null;

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
