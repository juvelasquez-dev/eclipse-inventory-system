import { createPortal } from "react-dom";

import type { Product } from "../../types/inventory";

export interface ReceiptItem {
  product: Product;
  quantity: number;
}

export interface ReceiptData {
  deliveryReceiptNumber: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  amountReceived: number;
  paymentMethod: string;
  createdAt: string;
  items: ReceiptItem[];
  subtotal: number;
  changeAmount: number;
}

interface DeliveryReceiptPrintProps {
  receipt: ReceiptData | null;
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DeliveryReceiptPrint({
  receipt,
}: DeliveryReceiptPrintProps) {
  if (!receipt || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="dr-receipt">
      <div className="dr-header">
        <p className="dr-brand">ECLIPSE</p>
        <p className="dr-company">Eclipse Food Trading OPC</p>
        <p className="dr-address">Caballero Compound Lower Balulang</p>
        <p className="dr-address">Cagayan De Oro City</p>
        <p className="dr-phone">09100000000</p>
      </div>

      <div className="dr-divider" />

      <div className="dr-doc">
        <p className="dr-doc-title">DELIVERY RECEIPT</p>
        <p className="dr-doc-number">
          {receipt.deliveryReceiptNumber}
        </p>
      </div>

      <div className="dr-divider" />

      <div className="dr-info">
        <div className="dr-info-row">
          <span>Date</span>
          <strong>
            {new Date(receipt.createdAt).toLocaleDateString("en-PH", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            })}
          </strong>
        </div>
        <div className="dr-info-row">
          <span>Time</span>
          <strong>
            {new Date(receipt.createdAt).toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
        </div>
        <div className="dr-info-row">
          <span>Customer</span>
          <strong>{receipt.customerName}</strong>
        </div>
        <div className="dr-info-row">
          <span>Address</span>
          <strong className="dr-wrap">
            {receipt.customerAddress}
          </strong>
        </div>
        <div className="dr-info-row">
          <span>Phone</span>
          <strong>{receipt.customerPhone}</strong>
        </div>
      </div>

      <div className="dr-divider" />

      <div className="dr-items">
        <div className="dr-items-head">
          <span className="dr-col-item">ITEM</span>
          <span className="dr-col-qty">QTY</span>
          <span className="dr-col-price">PRICE</span>
          <span className="dr-col-amount">AMOUNT</span>
        </div>

        {receipt.items.map((item) => {
          const lineTotal = item.product.price * item.quantity;

          return (
            <div
              key={item.product.id}
              className="dr-item-row"
            >
              <div className="dr-col-item">
                <strong>{item.product.name}</strong>
                <span className="dr-item-code">
                  {item.product.code}
                </span>
              </div>
              <span className="dr-col-qty">{item.quantity}</span>
              <span className="dr-col-price">
                {formatPrice(item.product.price)}
              </span>
              <strong className="dr-col-amount">
                {formatPrice(lineTotal)}
              </strong>
            </div>
          );
        })}
      </div>

      <div className="dr-divider" />

      <div className="dr-totals">
        <div className="dr-total-row">
          <span>Subtotal</span>
          <strong>{formatPrice(receipt.subtotal)}</strong>
        </div>
        <div className="dr-total-row">
          <span>Amount Received</span>
          <strong>{formatPrice(receipt.amountReceived)}</strong>
        </div>
        <div className="dr-total-row">
          <span>Change</span>
          <strong>{formatPrice(receipt.changeAmount)}</strong>
        </div>
        <div className="dr-total-row">
          <span>Payment</span>
          <strong>
            {receipt.paymentMethod === "CASH"
              ? "Cash"
              : receipt.paymentMethod}
          </strong>
        </div>
      </div>

      <div className="dr-divider dr-divider--thick" />

      <div className="dr-grand-total">
        <span>TOTAL</span>
        <strong>{formatPrice(receipt.subtotal)}</strong>
      </div>

      <div className="dr-divider" />

      <div className="dr-footer">
        <p>Thank you for your business!</p>
        <p>This document serves as your delivery receipt.</p>
        <p>Items are COMPLETE and in GOOD CONDITION</p>
        <p className="dr-footer-number">
          {receipt.deliveryReceiptNumber}
        </p>
      </div>
    </div>,
    document.body
  );
}
