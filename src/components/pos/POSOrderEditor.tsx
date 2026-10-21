import { useEffect, useMemo, useRef, useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Modal from "../ui/Modal";
import Select from "../ui/Select";
import { supabase } from "../../lib/supabase";
import type { Product } from "../../types/inventory";
import type { ReceiptItem } from "./DeliveryReceiptPrint";

export interface EditablePOSTransaction {
  id: string;
  revisionNumber: number;
  receiptNumber: string;
  transactionStatus: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  items: ReceiptItem[];
}

interface POSOrderEditorProps {
  transaction: EditablePOSTransaction;
  onClose: () => void;
  onSaved: (committedTotal: number, reopened: boolean) => void;
}

interface ModificationResponse {
  transaction_id: unknown;
  transaction_status: unknown;
  revision_number: unknown;
  subtotal: unknown;
  reopened: unknown;
}

interface LatestTransactionSnapshot {
  transaction: {
    revision_number: number;
    transaction_status: string;
    customer_name: string | null;
    customer_address: string | null;
    customer_phone: string | null;
  };
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}

interface LatestAuditResponse {
  revision_number: number;
  current_transaction_status: string;
  copied_to_iao: boolean;
  revisions: Array<{
    revision_number: number;
    snapshot: LatestTransactionSnapshot;
  }>;
}

interface ProductRow {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number | string;
  minimum_stock: number | null;
}

function formatPrice(price: number) {
  return `₱${price.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function parseQuantity(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 1 ? quantity : null;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    unit: row.unit,
    price: Math.round(Number(row.price) * 100) / 100,
    minimumStock: Number(row.minimum_stock ?? 0),
  };
}

export default function POSOrderEditor({
  transaction,
  onClose,
  onSaved,
}: POSOrderEditorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [productToAdd, setProductToAdd] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      transaction.items.map((item) => [item.product.id, item.quantity])
    )
  );
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState(transaction.customerName);
  const [customerAddress, setCustomerAddress] = useState(transaction.customerAddress);
  const [customerPhone, setCustomerPhone] = useState(transaction.customerPhone);
  const [revisionNumber, setRevisionNumber] = useState(transaction.revisionNumber);
  const [transactionStatus, setTransactionStatus] = useState(transaction.transactionStatus);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [revisionConflict, setRevisionConflict] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const requestAttemptRef = useRef<{ id: string; payload: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("id, code, name, category, unit, price, minimum_stock")
          .order("name");
        if (!active) return;
        if (error) {
          setLoadError(error.message);
        } else {
          setProducts((data ?? []).map(mapProduct));
        }
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load product prices."
          );
        }
      } finally {
        if (active) setLoadingProducts(false);
      }
    }

    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const selectedProducts = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => ({
          product: products.find((product) => product.id === id),
          id,
          quantity,
        })),
    [products, quantities]
  );
  const hasMissingProduct = selectedProducts.some(({ product }) => !product);
  const total = selectedProducts.reduce(
    (sum, { product, quantity }) =>
      sum + (product?.price ?? 0) * quantity,
    0
  );

  function addProduct() {
    if (!productToAdd) return;
    setQuantities((current) => ({
      ...current,
      [productToAdd]: current[productToAdd] ?? 1,
    }));
    setProductToAdd("");
  }

  function removeProduct(productId: string) {
    setQuantities((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function clearQuantityDraft(productId: string) {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    }
    return "Unable to save this POS correction.";
  }

  async function save() {
    if (saving) return;
    if (selectedProducts.length === 0 || hasMissingProduct) {
      setErrorMessage("Every order item must be available in the product catalog.");
      return;
    }
    if (
      Object.values(quantityDrafts).some(
        (draft) => parseQuantity(draft) === null
      )
    ) {
      setErrorMessage("Item quantities must be positive whole numbers.");
      return;
    }
    if (
      selectedProducts.some(
        ({ quantity }) => !Number.isSafeInteger(quantity) || quantity <= 0
      )
    ) {
      setErrorMessage("Item quantities must be positive whole numbers.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    const normalizedItems = selectedProducts
      .map(({ id, quantity }) => ({ product_id: id, quantity }))
      .sort((left, right) => left.product_id.localeCompare(right.product_id));
    const normalizedReason = reason.trim() || null;
    const requestPayload = JSON.stringify({
      transaction_id: transaction.id,
      expected_revision: revisionNumber,
      customer_name: customerName,
      customer_address: customerAddress,
      customer_phone: customerPhone,
      reason: normalizedReason,
      items: normalizedItems,
    });
    if (requestAttemptRef.current?.payload !== requestPayload) {
      requestAttemptRef.current = {
        id: crypto.randomUUID(),
        payload: requestPayload,
      };
    }
    const requestId = requestAttemptRef.current?.id;
    if (!requestId) {
      setErrorMessage("Unable to prepare a safe retry identifier. Please try again.");
      setSaving(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("modify_pos_transaction", {
        p_transaction_id: transaction.id,
        p_expected_revision: revisionNumber,
        p_request_id: requestId,
        p_customer_name: customerName,
        p_customer_address: customerAddress,
        p_customer_phone: customerPhone,
        p_items: normalizedItems,
        p_reason: reason,
      });
      if (error) throw error;
      if (
        typeof data !== "object" ||
        data === null ||
        !("transaction_id" in data) ||
        !("transaction_status" in data) ||
        !("revision_number" in data) ||
        !("subtotal" in data) ||
        !("reopened" in data)
      ) {
        throw new Error("The correction was saved, but the server returned an invalid confirmation. Retry without changing the order to confirm the result.");
      }
      const response = data as ModificationResponse;
      if (
        response.transaction_id !== transaction.id ||
        response.transaction_status !== "COMPLETED" ||
        typeof response.revision_number !== "number" ||
        response.revision_number !== revisionNumber + 1 ||
        typeof response.subtotal !== "number" ||
        !Number.isFinite(response.subtotal) ||
        typeof response.reopened !== "boolean"
      ) {
        throw new Error("The correction was saved, but the server returned an unexpected confirmation. Retry without changing the order to confirm the result.");
      }
      requestAttemptRef.current = null;
      onSaved(response.subtotal, response.reopened);
    } catch (error) {
      const message = getErrorMessage(error);
      setErrorMessage(message);
      setRevisionConflict(
        message.toLowerCase().includes("changed since it was opened") ||
          message.toLowerCase().includes("reload before saving")
      );
    } finally {
      setSaving(false);
    }
  }

  async function reloadLatestTransaction() {
    if (saving || reloading) return;
    setReloading(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.rpc("get_pos_transaction_audit", {
        p_transaction_id: transaction.id,
      });
      if (error) throw error;
      if (
        typeof data !== "object" ||
        data === null ||
        !("revision_number" in data) ||
        !("current_transaction_status" in data) ||
        !("copied_to_iao" in data) ||
        !("revisions" in data)
      ) {
        throw new Error("The latest transaction history returned an invalid response.");
      }
      const audit = data as LatestAuditResponse;
      if (
        !Number.isInteger(audit.revision_number) ||
        !["COMPLETED", "CANCELLED"].includes(
          audit.current_transaction_status
        ) ||
        typeof audit.copied_to_iao !== "boolean"
      ) {
        throw new Error("The latest transaction history returned an invalid response.");
      }
      if (audit.copied_to_iao !== false) {
        throw new Error("This transaction has been copied to an IAO order and cannot be modified. Your unsaved changes were kept.");
      }
      if (!Array.isArray(audit.revisions)) {
        throw new Error("The latest transaction revision could not be verified.");
      }
      const latestRevision = audit.revisions[0];
      if (
        !latestRevision ||
        latestRevision.revision_number !== audit.revision_number
      ) {
        throw new Error("The latest transaction revision could not be verified.");
      }
      if (
        typeof latestRevision.snapshot !== "object" ||
        latestRevision.snapshot === null ||
        typeof latestRevision.snapshot.transaction !== "object" ||
        latestRevision.snapshot.transaction === null
      ) {
        throw new Error("The latest transaction snapshot is incomplete.");
      }
      const latest = latestRevision.snapshot.transaction;
      if (
        !Number.isInteger(latest.revision_number) ||
        latest.revision_number < 1 ||
        !["COMPLETED", "CANCELLED"].includes(latest.transaction_status)
      ) {
        throw new Error("The latest transaction has an unsupported status or revision.");
      }
      const latestItems = latestRevision.snapshot.items;
      if (
        !Array.isArray(latestItems) ||
        latestItems.length === 0 ||
        latestItems.some(
          (item) =>
            typeof item !== "object" ||
            item === null ||
            !item.product_id ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity <= 0
        )
      ) {
        throw new Error("The latest transaction items could not be loaded safely.");
      }

      setCustomerName(latest.customer_name ?? "");
      setCustomerAddress(latest.customer_address ?? "");
      setCustomerPhone(latest.customer_phone ?? "");
      setQuantities(
        Object.fromEntries(latestItems.map((item) => [item.product_id, item.quantity]))
      );
      setQuantityDrafts({});
      setRevisionNumber(latest.revision_number);
      setTransactionStatus(audit.current_transaction_status);
      setReason("");
      setProductToAdd("");
      requestAttemptRef.current = null;
      setRevisionConflict(false);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setReloading(false);
    }
  }

  function requestClose() {
    if (saving || reloading) return;
    if (revisionConflict) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  return (
    <Modal
      open
      title={
        transactionStatus === "CANCELLED"
          ? "Correct and Reactivate Order"
          : "Modify POS Order"
      }
      onClose={requestClose}
      wide
    >
      <div className="space-y-5">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <span className="font-semibold">Original receipt:</span>{" "}
            {transaction.receiptNumber}
            <span className="ml-3">
              Revision {revisionNumber}
            </span>
              {transactionStatus === "CANCELLED" && (
              <p className="mt-1 text-emerald-800">
                Saving will reactivate this same transaction and receipt.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Customer" value={customerName} onChange={(event) => setCustomerName(event.target.value)} disabled={saving || reloading} />
            <Input label="Address" value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} disabled={saving || reloading} />
            <Input label="Phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} disabled={saving || reloading} />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Select
              label="Add product"
              value={productToAdd}
              onChange={(event) => setProductToAdd(event.target.value)}
              disabled={loadingProducts || saving || reloading}
              options={[
                { label: loadingProducts ? "Loading products..." : "Select a product", value: "" },
                ...products
                  .filter((product) => !(product.id in quantities))
                  .map((product) => ({
                    label: `${product.name} (${product.code}) — ${formatPrice(product.price)}`,
                    value: product.id,
                  })),
              ]}
            />
            <Button type="button" variant="secondary" onClick={addProduct} disabled={!productToAdd || saving || reloading}>
              Add item
            </Button>
          </div>

          {loadError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Unable to load current product prices: {loadError}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Product</th>
                  <th className="p-3 text-right">Current unit price</th>
                  <th className="w-32 p-3 text-center">Quantity</th>
                  <th className="p-3 text-right">Line total</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedProducts.map(({ id, product, quantity }) => (
                  <tr key={id}>
                    <td className="p-3">
                      <div className="font-medium">{product?.name ?? id}</div>
                      <div className="text-xs text-slate-500">{product?.code ?? "Product unavailable"}</div>
                    </td>
                    <td className="p-3 text-right">{product ? formatPrice(product.price) : "-"}</td>
                    <td className="p-3">
                      <div className="mx-auto flex w-fit items-center overflow-hidden rounded-md border border-slate-300">
                        <button
                          type="button"
                          aria-label={`Decrease quantity for ${product?.name ?? id}`}
                          className="flex h-8 w-8 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            clearQuantityDraft(id);
                            setQuantities((current) => ({
                              ...current,
                              [id]: Math.max(1, current[id] - 1),
                            }));
                          }}
                          disabled={saving || reloading || quantity <= 1}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          aria-label={`Quantity for ${product?.name ?? id}`}
                          className="h-8 w-14 border-x border-slate-300 bg-transparent px-1 text-center tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-500"
                          value={quantityDrafts[id] ?? String(quantity)}
                          disabled={saving || reloading}
                          onChange={(event) => {
                            const draft = event.target.value;
                            setQuantityDrafts((current) => ({
                              ...current,
                              [id]: draft,
                            }));
                            const parsedQuantity = parseQuantity(draft);
                            if (parsedQuantity !== null) {
                              setQuantities((current) => ({
                                ...current,
                                [id]: parsedQuantity,
                              }));
                            }
                          }}
                          onBlur={(event) => {
                            const parsedQuantity = parseQuantity(
                              event.currentTarget.value
                            );
                            if (parsedQuantity !== null) {
                              setQuantities((current) => ({
                                ...current,
                                [id]: parsedQuantity,
                              }));
                            }
                            clearQuantityDraft(id);
                          }}
                        />
                        <button
                          type="button"
                          aria-label={`Increase quantity for ${product?.name ?? id}`}
                          className="flex h-8 w-8 items-center justify-center text-lg text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => {
                            clearQuantityDraft(id);
                            setQuantities((current) => ({
                              ...current,
                              [id]: current[id] + 1,
                            }));
                          }}
                          disabled={saving || reloading}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      {product ? formatPrice(product.price * quantity) : "-"}
                    </td>
                    <td className="p-3 text-right">
                      <button type="button" className="text-red-600 hover:text-red-800" onClick={() => removeProduct(id)} disabled={saving || reloading}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {selectedProducts.length === 0 && (
                  <tr><td className="p-5 text-center text-slate-500" colSpan={5}>Add at least one product.</td></tr>
                )}
              </tbody>
              <tfoot className="border-t bg-slate-50">
                <tr>
                  <th className="p-3 text-left" colSpan={3}>Recalculated total</th>
                  <th className="p-3 text-right">{formatPrice(total)}</th>
                  <th />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Prices shown are current catalog prices. The database re-reads authoritative prices when saving. Corrections preserve checkout estimates; they do not record actual payment, which is collected upon delivery.
          </p>
          <Input label="Correction reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving || reloading} />
          {errorMessage && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          {revisionConflict && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                A newer revision exists. Your unsaved changes are still here. Reloading replaces them with the latest saved order; saving cannot succeed until you reload.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => void reloadLatestTransaction()} disabled={reloading || saving}>
                  {reloading ? "Reloading..." : "Reload latest and discard my changes"}
                </Button>
                <Button type="button" variant="danger" onClick={() => setConfirmDiscard(true)} disabled={reloading || saving}>
                  Discard my changes and close
                </Button>
              </div>
            </div>
          )}
          {confirmDiscard && (
            <div role="alertdialog" aria-label="Confirm discarding unsaved changes" className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <p>Discard your unsaved correction and close this editor?</p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" onClick={onClose} disabled={saving || reloading}>
                  Discard changes
                </Button>
                <Button type="button" variant="secondary" onClick={() => setConfirmDiscard(false)} disabled={saving || reloading}>
                  Continue editing
                </Button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={requestClose} disabled={saving || reloading}>Keep current order</Button>
            <Button type="button" onClick={() => void save()} disabled={saving || reloading || loadingProducts || Boolean(loadError) || hasMissingProduct}>
              {saving ? "Saving..." : transactionStatus === "CANCELLED" ? "Save and Reactivate" : "Save Correction"}
            </Button>
          </div>
      </div>
    </Modal>
  );
}
