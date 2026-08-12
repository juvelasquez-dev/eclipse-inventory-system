import { useState } from "react";

import ProductForm, {
  type ProductFormData,
} from "../components/inventory/ProductForm";
import ProductTable from "../components/inventory/ProductTable";
import { useToast } from "../context/ToastContext";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

import { useInventory } from "../hooks/useInventory";

import type { Product } from "../types/inventory";

export default function Products() {
  const [open, setOpen] = useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [deletingProduct, setDeletingProduct] =
    useState<Product | null>(null);

  const [search, setSearch] =
    useState("");

  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useInventory();
const { showToast } = useToast();

  const filteredProducts =
    products.filter((product) => {
      const keyword =
        search.toLowerCase();

      return (
        product.name
          .toLowerCase()
          .includes(keyword) ||
        product.code
          .toLowerCase()
          .includes(keyword)
      );
    });

  function handleSubmit(
  data: ProductFormData
) {
  if (editingProduct) {
    updateProduct({
      ...editingProduct,
      ...data,
    });

    showToast("Product updated successfully.");
  } else {
    addProduct({
      id: crypto.randomUUID(),
      ...data,
    });

    showToast("Product added successfully.");
  }

  setEditingProduct(null);
  setOpen(false);
}

function handleAddProduct() {
  setEditingProduct(null);
  setOpen(true);
}

function handleEditProduct(
  product: Product
) {
  setEditingProduct(product);
  setOpen(true);
}

function handleDeleteProduct(
  product: Product
) {
  setDeletingProduct(product);
}

function confirmDeleteProduct() {
  if (!deletingProduct) return;

  const deleted = deleteProduct(
    deletingProduct.id
  );

  if (!deleted) {
    showToast(
      "This product cannot be deleted because it has transaction history."
    );

    setDeletingProduct(null);
    return;
  }

  showToast(
    "Product deleted successfully."
  );

  setDeletingProduct(null);
}

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">

        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8 sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                Catalog
              </span>

              <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                Products
              </h1>

              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Manage your product catalog.
              </p>
            </div>

            <Button onClick={handleAddProduct}>
              + Add Product
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">

          <input
            type="text"
            placeholder="Search by product name or code..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
          />

          <ProductTable
            products={filteredProducts}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
          />

        </div>

        <Modal
          open={open}
          title={
            editingProduct
              ? "Edit Product"
              : "Add Product"
          }
          onClose={() => {
            setEditingProduct(null);
            setOpen(false);
          }}
        >
          <ProductForm
            initialValues={
              editingProduct ?? undefined
            }
            onSubmit={handleSubmit}
          />
        </Modal>

        <ConfirmModal
          open={!!deletingProduct}
          title="Delete Product"
          message={
            deletingProduct
              ? `Are you sure you want to delete "${deletingProduct.name}"? This action cannot be undone.`
              : ""
          }
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDeleteProduct}
          onCancel={() =>
            setDeletingProduct(null)
          }
        />

      </div>
    </div>
  );
}