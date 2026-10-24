export type ReceiptPrintFormat = "thermal" | "a4-two-copy" | "iao-a4";

let activeCleanup: (() => void) | null = null;

export function printReceipt(format: ReceiptPrintFormat) {
  const attribute = "data-receipt-print-format";

  // Clear any format left over from a previous print before applying a new one.
  activeCleanup?.();

  const cleanup = () => {
    window.removeEventListener("afterprint", cleanup);
    delete document.documentElement.dataset.receiptPrintFormat;
    delete document.body.dataset.receiptPrintFormat;
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;

  document.documentElement.setAttribute(attribute, format);
  document.body.setAttribute(attribute, format);
  window.addEventListener("afterprint", cleanup, { once: true });

  try {
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
