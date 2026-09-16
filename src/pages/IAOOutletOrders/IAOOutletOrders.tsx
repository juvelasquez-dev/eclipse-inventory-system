import { useMemo, useState } from "react";
import { ArrowLeft, ClipboardCopy, History, Plus, Printer, Save, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import IAOOutletOrderReceiptPrint, {
  type IAOOutletOrderReceipt,
} from "../../components/iao/IAOOutletOrderReceiptPrint";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Select from "../../components/ui/Select";
import { useInventoryContext } from "../../context/InventoryContext";
import { useToast } from "../../context/ToastContext";
import { supabase } from "../../lib/supabase";
import type { Outlet, Product } from "../../types/inventory";

interface OrderItem {
  product: Product;
  quantity: number;
  sellingPrice: string;
}

interface EligiblePosTransaction {
  posTransactionId: string;
  sourceReceipt: string;
  createdAt: string;
  outletName: string;
  outletAddress: string;
  totalAmount: number;
  paymentMethod: string;
}

interface CopyPreviewItem {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  eclipseReferenceUnitPrice: number;
  sellingPrice: string;
}

function formatPrice(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function IAOOutletOrders() {
  const navigate = useNavigate();
  const { products, outlets, inventory } = useInventoryContext();
  const { showToast } = useToast();
  const [outletSearch, setOutletSearch] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [stockStatus, setStockStatus] = useState("ALL");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [receipt, setReceipt] = useState<IAOOutletOrderReceipt | null>(null);

  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySearch, setCopySearch] = useState("");
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [eligibleTransactions, setEligibleTransactions] = useState<EligiblePosTransaction[]>([]);
  const [selectedPos, setSelectedPos] = useState<EligiblePosTransaction | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<CopyPreviewItem[]>([]);
  const [isCopying, setIsCopying] = useState(false);

  const matchingOutlets = useMemo(() => {
    const query = outletSearch.trim().toLowerCase();
    return outlets.filter((outlet) => {
      if (outlet.areaCode !== "IAO" || outlet.status !== "Active") return false;
      return !query || [outlet.outletName, outlet.contactPerson, outlet.degicNumber, outlet.completeAddress]
        .join(" ").toLowerCase().includes(query);
    }).slice(0, 10);
  }, [outletSearch, outlets]);

  const availableProducts = useMemo(() => products.filter(
    (product) => !items.some((item) => item.product.id === product.id)
  ), [items, products]);

  const categoryOptions = useMemo(() => Array.from(
    new Set(products.map((product) => product.category).filter(Boolean))
  ).sort(), [products]);

  const unitOptions = useMemo(() => Array.from(
    new Set(products.map((product) => product.unit).filter(Boolean))
  ).sort(), [products]);

  const inventoryByProductId = useMemo(() => new Map(
    inventory.map((product) => [product.id, product])
  ), [inventory]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return availableProducts.filter((product) =>
      (!query || [product.name, product.code].join(" ").toLowerCase().includes(query)) &&
      (!categoryFilter || product.category === categoryFilter) &&
      (!unitFilter || product.unit === unitFilter) &&
      (stockStatus === "ALL" || (() => {
        const stock = inventoryByProductId.get(product.id)?.stock ?? 0;
        if (stockStatus === "IN_STOCK") return stock > 0;
        return stock > 0 && stock <= product.minimumStock;
      })())
    );
  }, [availableProducts, productSearch, categoryFilter, unitFilter, stockStatus, inventoryByProductId]);

  const hasProductFilters = Boolean(productSearch.trim() || categoryFilter || unitFilter || stockStatus !== "ALL");

  function clearProductFilters() {
    setProductSearch("");
    setCategoryFilter("");
    setUnitFilter("");
    setStockStatus("ALL");
  }

  const grandTotal = items.reduce((total, item) => {
    const sellingPrice = Number(item.sellingPrice);
    return total + (Number.isFinite(sellingPrice) ? sellingPrice * item.quantity : 0);
  }, 0);

  function addProduct(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setItems((current) => [...current, { product, quantity: 1, sellingPrice: "" }]);
  }

  function updateItem(productId: string, changes: Partial<OrderItem>) {
    setItems((current) => current.map((item) => item.product.id === productId ? { ...item, ...changes } : item));
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.product.id !== productId));
  }

  async function saveOrder() {
    if (!selectedOutlet) {
      showToast("Select an active IAO outlet.", "error");
      return;
    }
    if (items.length === 0) {
      showToast("Add at least one product.", "error");
      return;
    }
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(Number(item.sellingPrice)) || Number(item.sellingPrice) <= 0)) {
      showToast("Each item needs a quantity and an IAO selling price greater than zero.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_iao_outlet_order", {
        p_outlet_id: selectedOutlet.id,
        p_items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          iao_selling_unit_price: Number(item.sellingPrice),
        })),
      });
      if (error) throw error;

      const result = data as IAOOutletOrderReceipt | null;
      if (!result?.receiptNumber) throw new Error("Order was created without receipt data.");

      setReceipt(result);
      setItems([]);
      setSelectedOutlet(null);
      setOutletSearch("");
      showToast(`IAO order saved: ${result.receiptNumber}`);
    } catch (error) {
      console.error("Unable to create IAO outlet order:", error);
      showToast(error instanceof Error ? error.message : "Unable to save the IAO outlet order.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  const matchingEligibleTransactions = useMemo(() => {
    const query = copySearch.trim().toLowerCase();
    if (!query) return eligibleTransactions;
    return eligibleTransactions.filter((transaction) =>
      [transaction.outletName, transaction.outletAddress, transaction.sourceReceipt]
        .join(" ").toLowerCase().includes(query)
    );
  }, [copySearch, eligibleTransactions]);

  const previewGrandTotal = previewItems.reduce((total, item) => {
    const sellingPrice = Number(item.sellingPrice);
    return total + (Number.isFinite(sellingPrice) ? sellingPrice * item.quantity : 0);
  }, 0);

  function openCopyModal() {
    setShowCopyModal(true);
    setSelectedPos(null);
    setPreviewItems([]);
    setCopySearch("");
    void loadEligibleTransactions();
  }

  function closeCopyModal() {
    setShowCopyModal(false);
    setSelectedPos(null);
    setPreviewItems([]);
    setCopySearch("");
  }

  async function loadEligibleTransactions() {
    setEligibleLoading(true);
    try {
      const { data, error } = await supabase.rpc("list_iao_eligible_pos_transactions");
      if (error) throw error;
      setEligibleTransactions((data ?? []).map((row: any) => ({
        posTransactionId: row.pos_transaction_id,
        sourceReceipt: row.source_receipt,
        createdAt: row.created_at,
        outletName: row.outlet_name,
        outletAddress: row.outlet_address,
        totalAmount: Number(row.total_amount),
        paymentMethod: row.payment_method,
      })));
    } catch (error) {
      console.error("Unable to load eligible POS transactions:", error);
      showToast(error instanceof Error ? error.message : "Unable to load eligible POS transactions.", "error");
    } finally {
      setEligibleLoading(false);
    }
  }

  async function selectPosTransaction(transaction: EligiblePosTransaction) {
    setSelectedPos(transaction);
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_iao_pos_transaction_preview", {
        p_pos_transaction_id: transaction.posTransactionId,
      });
      if (error) throw error;
      setPreviewItems((data ?? []).map((row: any) => ({
        productId: row.product_id,
        productCode: row.product_code_snapshot,
        productName: row.product_name_snapshot,
        unit: row.unit_snapshot,
        quantity: Number(row.quantity),
        eclipseReferenceUnitPrice: Number(row.eclipse_reference_unit_price),
        sellingPrice: "",
      })));
    } catch (error) {
      console.error("Unable to load POS transaction items:", error);
      showToast(error instanceof Error ? error.message : "Unable to load POS transaction items.", "error");
      setSelectedPos(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  function updatePreviewPrice(productId: string, sellingPrice: string) {
    setPreviewItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, sellingPrice } : item))
    );
  }

  async function confirmCopy() {
    if (!selectedPos) return;
    if (previewItems.length === 0) {
      showToast("This POS transaction has no items to copy.", "error");
      return;
    }
    if (previewItems.some((item) => !Number.isFinite(Number(item.sellingPrice)) || Number(item.sellingPrice) <= 0)) {
      showToast("Enter an IAO selling price greater than zero for every item.", "error");
      return;
    }

    setIsCopying(true);
    try {
      const sellingPrices = previewItems.reduce<Record<string, number>>((map, item) => {
        map[item.productId] = Number(item.sellingPrice);
        return map;
      }, {});

      const { data, error } = await supabase.rpc("create_iao_outlet_order_from_pos", {
        p_pos_transaction_id: selectedPos.posTransactionId,
        p_selling_prices: sellingPrices,
      });
      if (error) throw error;

      const result = data as IAOOutletOrderReceipt | null;
      if (!result?.receiptNumber) throw new Error("Order was created without receipt data.");

      setReceipt(result);
      closeCopyModal();
      showToast(`IAO order copied from ${result.sourceReceipt ?? result.receiptNumber}`);
    } catch (error) {
      console.error("Unable to copy IAO outlet order from POS:", error);
      showToast(error instanceof Error ? error.message : "Unable to copy the IAO outlet order.", "error");
    } finally {
      setIsCopying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-cyan-100 to-emerald-100 opacity-70 blur-2xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="relative">
              <button type="button" onClick={() => navigate("/system")} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-cyan-700">
                <ArrowLeft size={16} /> Back to Systems
              </button>
              <span className="mt-5 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">IAO Distribution</span>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">IAO Outlet Orders</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-500">Build an outlet order using Eclipse reference prices and your IAO selling prices.</p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={openCopyModal}>
                <ClipboardCopy size={16} /> Copy from Eclipse POS
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate("/iao-outlet-orders/history")}>
                <History size={16} /> Transaction History
              </Button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Order destination</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Select an active IAO outlet</h2>
            </div>
            {selectedOutlet && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm lg:min-w-72">
                <p className="font-semibold text-emerald-800">{selectedOutlet.outletName}</p>
                <p className="mt-1 text-xs text-emerald-700">{selectedOutlet.completeAddress} · {selectedOutlet.contactNumber}</p>
              </div>
            )}
          </div>
          <div className="mt-4 max-w-xl">
            <Input label="Search outlets" value={outletSearch} onChange={(event) => setOutletSearch(event.target.value)} placeholder="Name, contact, DEGIC, or address" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {matchingOutlets.map((outlet) => (
              <button key={outlet.id} type="button" onClick={() => { setSelectedOutlet(outlet); setOutletSearch(outlet.outletName); }} className={`min-w-64 rounded-xl border p-3 text-left transition ${selectedOutlet?.id === outlet.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300 hover:bg-slate-50"}`}>
                <p className="truncate font-semibold text-slate-900">{outlet.outletName}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{outlet.completeAddress} · {outlet.contactNumber}</p>
              </button>
            ))}
            {matchingOutlets.length === 0 && <p className="py-4 text-sm text-slate-500">No active IAO outlets found.</p>}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(320px,1fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Products</h2>
                <p className="mt-1 text-sm text-slate-500">Select a product to add it to the IAO order.</p>
              </div>
              <p className="text-xs font-medium text-slate-400">{filteredProducts.length} {filteredProducts.length === 1 ? "product" : "products"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input label="Search" type="text" placeholder="Product name or code..." value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
                <Select label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} options={[{ value: "", label: "All Categories" }, ...categoryOptions.map((category) => ({ value: category, label: category }))]} />
                <Select label="Unit / Size" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} options={[{ value: "", label: "All Units" }, ...unitOptions.map((unit) => ({ value: unit, label: unit }))]} />
                <Select label="Stock Status" value={stockStatus} onChange={(event) => setStockStatus(event.target.value)} options={[{ value: "ALL", label: "All Stock" }, { value: "IN_STOCK", label: "In Stock" }, { value: "LOW_STOCK", label: "Low Stock" }]} />
              </div>
              {hasProductFilters && (
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={clearProductFilters} className="text-xs font-medium text-slate-500 transition hover:text-slate-800">Clear filters</button>
                </div>
              )}
            </div>
            <div className="mt-5 max-h-[calc(100vh-25rem)] overflow-y-auto pr-1">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <button key={product.id} type="button" onClick={() => addProduct(product.id)} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{product.name}</p>
                          <p className="mt-1 text-xs text-slate-400">{product.code}</p>
                          <p className="mt-1 truncate text-xs text-slate-400">{product.category}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">{product.unit}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <span className="text-base font-bold tabular-nums text-emerald-700">{formatPrice(product.price)}</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100"><Plus size={13} /> Add</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-400">Eclipse reference price</p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
                  <Search className="mx-auto text-slate-300" size={22} />
                  <p className="mt-2 text-sm font-medium text-slate-600">No products found.</p>
                  <p className="mt-1 text-xs text-slate-400">Try a different search.</p>
                </div>
              )}
            </div>
          </section>

          <section className="flex max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 p-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Current IAO Order</h2>
                <p className="mt-1 text-sm text-slate-500">{items.reduce((total, item) => total + item.quantity, 0)} {items.reduce((total, item) => total + item.quantity, 0) === 1 ? "item" : "items"}</p>
              </div>
              {items.length > 0 && <button type="button" onClick={() => setItems([])} className="text-xs font-medium text-red-500 transition hover:text-red-700">Clear Order</button>}
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center">
                  <div><p className="text-sm font-medium text-slate-600">Your order is empty</p><p className="mt-1 text-xs text-slate-400">Select a product to get started.</p></div>
                </div>
              ) : items.map((item) => {
                const sellingPrice = Number(item.sellingPrice);
                const lineTotal = Number.isFinite(sellingPrice) ? sellingPrice * item.quantity : 0;
                return (
                  <div key={item.product.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate font-medium text-slate-900">{item.product.name}</p><p className="mt-1 text-xs text-slate-400">{item.product.code} · {item.product.unit}</p></div>
                      <button type="button" onClick={() => removeItem(item.product.id)} aria-label={`Remove ${item.product.name}`} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="text-slate-500">Eclipse reference price</span>
                      <span className="font-semibold tabular-nums text-slate-700">{formatPrice(item.product.price)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                      <div><label className="text-xs font-medium text-slate-500">Quantity</label><div className="mt-1 flex items-center overflow-hidden rounded-lg border border-slate-200"><button type="button" onClick={() => updateItem(item.product.id, { quantity: Math.max(1, item.quantity - 1) })} className="flex h-9 w-9 items-center justify-center text-lg text-slate-600 hover:bg-slate-100">−</button><span className="flex h-9 min-w-9 flex-1 items-center justify-center border-x border-slate-200 text-sm font-semibold tabular-nums text-slate-900">{item.quantity}</span><button type="button" onClick={() => updateItem(item.product.id, { quantity: item.quantity + 1 })} className="flex h-9 w-9 items-center justify-center text-lg text-slate-600 hover:bg-slate-100">+</button></div></div>
                      <div><label className="text-xs font-medium text-slate-500">IAO selling price</label><input aria-label={`IAO selling price for ${item.product.name}`} type="number" min="0.01" step="0.01" value={item.sellingPrice} onChange={(event) => updateItem(item.product.id, { sellingPrice: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-right text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">Line total</span><span className="font-semibold tabular-nums text-slate-900">{formatPrice(lineTotal)}</span></div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-200 bg-slate-50/60 p-5">
              <div className="flex items-center justify-between text-sm text-slate-500"><span>Grand total</span><span className="font-medium tabular-nums text-slate-900">{formatPrice(grandTotal)}</span></div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-base font-semibold text-slate-900">Total</span><span className="text-2xl font-bold tabular-nums text-emerald-700">{formatPrice(grandTotal)}</span></div>
              <Button type="button" onClick={saveOrder} disabled={isSaving || !selectedOutlet || items.length === 0} className="mt-5 w-full !py-3 text-base">{isSaving ? "Saving..." : <><Save size={16} /> Save IAO Order</>}</Button>
            </div>
          </section>
        </div>

        {receipt && <div className="flex justify-end"><Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print last receipt</Button></div>}
      </div>

      <Modal open={showCopyModal} title={selectedPos ? "Review copied items" : "Copy from Eclipse POS"} onClose={closeCopyModal}>
        {!selectedPos ? (
          <div className="space-y-4">
            <Input label="Search by outlet or receipt" value={copySearch} onChange={(event) => setCopySearch(event.target.value)} placeholder="Outlet name, address, or receipt" />
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {eligibleLoading && <p className="py-6 text-center text-sm text-slate-500">Loading eligible transactions...</p>}
              {!eligibleLoading && matchingEligibleTransactions.map((transaction) => (
                <button
                  key={transaction.posTransactionId}
                  type="button"
                  onClick={() => selectPosTransaction(transaction)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-cyan-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{transaction.outletName}</p>
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-200">{transaction.sourceReceipt}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{transaction.outletAddress}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(transaction.createdAt).toLocaleString("en-PH")} · {formatPrice(transaction.totalAmount)} · {transaction.paymentMethod}
                  </p>
                </button>
              ))}
              {!eligibleLoading && matchingEligibleTransactions.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">No eligible completed POS transactions found for active IAO outlets.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={() => { setSelectedPos(null); setPreviewItems([]); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-cyan-700">
              <ArrowLeft size={14} /> Back to list
            </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source POS receipt</p>
              <p className="text-lg font-bold text-slate-900">{selectedPos.sourceReceipt}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedPos.outletName}</p>
              <p className="text-xs text-slate-500">{selectedPos.outletAddress}</p>
            </div>

            {previewLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading items...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="pb-2">Product</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Eclipse reference</th><th className="pb-2 text-right">IAO selling price</th><th className="pb-2 text-right">Line total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewItems.map((item) => {
                      const sellingPrice = Number(item.sellingPrice);
                      const lineTotal = Number.isFinite(sellingPrice) ? sellingPrice * item.quantity : 0;
                      return (
                        <tr key={item.productId}>
                          <td className="py-2"><p className="font-medium text-slate-900">{item.productName}</p><p className="text-xs text-slate-500">{item.productCode} · {item.unit}</p></td>
                          <td className="py-2 text-center">{item.quantity}</td>
                          <td className="py-2 text-right text-slate-500">{formatPrice(item.eclipseReferenceUnitPrice)}</td>
                          <td className="py-2 text-right">
                            <input
                              aria-label={`IAO selling price for ${item.productName}`}
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.sellingPrice}
                              onChange={(event) => updatePreviewPrice(item.productId, event.target.value)}
                              className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                            />
                          </td>
                          <td className="py-2 text-right font-semibold text-slate-900">{formatPrice(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div>
                <p className="text-sm text-slate-500">IAO total</p>
                <p className="text-xl font-bold text-slate-900">{formatPrice(previewGrandTotal)}</p>
              </div>
              <Button type="button" onClick={confirmCopy} disabled={isCopying || previewLoading || previewItems.length === 0}>
                {isCopying ? "Copying..." : <><Save size={16} /> Confirm copy</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <IAOOutletOrderReceiptPrint receipt={receipt} />
    </div>
  );
}
