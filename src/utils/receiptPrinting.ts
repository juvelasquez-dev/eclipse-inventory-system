export type ReceiptPrintFormat = "thermal" | "a4-two-copy";

export function printReceipt(format: ReceiptPrintFormat) {
  const attribute = "data-receipt-print-format";
  const cleanup = () => {
    delete document.documentElement.dataset.receiptPrintFormat;
    delete document.body.dataset.receiptPrintFormat;
  };

  document.documentElement.setAttribute(attribute, format);
  document.body.setAttribute(attribute, format);
  window.addEventListener("afterprint", cleanup, { once: true });

  try {
    window.print();
  } catch (error) {
    window.removeEventListener("afterprint", cleanup);
    cleanup();
    throw error;
  }
}
