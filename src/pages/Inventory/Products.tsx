import { useEffect, useState } from "react";

import ProductForm, {
  type ProductFormData,
} from "../../components/inventory/ProductForm";

import ProductTable from "../../components/inventory/ProductTable";

import { useToast } from "../../context/ToastContext";

import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

import { useInventory } from "../../hooks/useInventory";
import { categories } from "../../mock/categories";

import type { Product } from "../../types/inventory";

const PRODUCTS_PER_PAGE = 10;

export default function Products() {
  const [open, setOpen] = useState(false);

  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  const [deletingProduct, setDeletingProduct] =
    useState<Product | null>(null);

  const [search, setSearch] = useState("");

  const [sizeFilter, setSizeFilter] =
    useState("ALL");

  const [currentPage, setCurrentPage] =
    useState(1);

  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
  } = useInventory();

  const { showToast } = useToast();

  /*
   * Filter products by search and size.
   */
  const filteredProducts = products
    .filter((product) => {
      const keyword =
        search.toLowerCase().trim();

      if (!keyword) {
        return true;
      }

      return (
        product.name
          .toLowerCase()
          .includes(keyword) ||
        product.code
          .toLowerCase()
          .includes(keyword)
      );
    })
    .filter((product) => {
      if (sizeFilter === "ALL") {
        return true;
      }

      return product.category === sizeFilter;
    });

  /*
   * Pagination calculations.
   */
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredProducts.length /
        PRODUCTS_PER_PAGE
    )
  );

  const paginatedProducts =
    filteredProducts.slice(
      (currentPage - 1) *
        PRODUCTS_PER_PAGE,
      currentPage *
        PRODUCTS_PER_PAGE
    );

  /*
   * Reset to page 1 whenever
   * search or filter changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sizeFilter]);

  /*
   * If deleting/editing causes the
   * current page to become invalid,
   * move back to the last available page.
   */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  /*
   * Add or update product.
   */
  async function handleSubmit(
    data: ProductFormData
  ) {
    if (editingProduct) {
      const updated =
        await updateProduct({
          ...editingProduct,
          ...data,
        });

      if (!updated) {
        showToast(
          "Failed to update product."
        );
        return;
      }

      showToast(
        "Product updated successfully."
      );
    } else {
      const added =
        await addProduct({
          id: crypto.randomUUID(),
          ...data,
        });

      if (!added) {
        showToast(
          "This product already exists."
        );
        return;
      }

      showToast(
        "Product added successfully."
      );
    }

    setEditingProduct(null);
    setOpen(false);
  }

  /*
   * Open Add Product modal.
   */
  function handleAddProduct() {
    setEditingProduct(null);
    setOpen(true);
  }

  /*
   * Open Edit Product modal.
   */
  function handleEditProduct(
    product: Product
  ) {
    setEditingProduct(product);
    setOpen(true);
  }

  /*
   * Open Delete confirmation modal.
   */
  function handleDeleteProduct(
    product: Product
  ) {
    setDeletingProduct(product);
  }

  /*
   * Confirm product deletion.
   */
  async function confirmDeleteProduct() {
    if (!deletingProduct) {
      return;
    }

    const deleted =
      await deleteProduct(
        deletingProduct.id
      );

    if (deleted) {
      showToast(
        "Product deleted successfully."
      );
    } else {
      showToast(
        "This product cannot be deleted because it has transaction history."
      );
    }

    setDeletingProduct(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 opacity-60 blur-2xl" />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                Catalog
              </span>

              <h1 className="mt-4 bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                Products
              </h1>

              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Manage your product catalog.
              </p>
            </div>

            <Button
              onClick={handleAddProduct}
            >
              + Add Product
            </Button>

          </div>
        </div>

        {/* Product Content */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">

          {/* Filters */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">

            {/* Search */}
            <div className="md:col-span-2">
              <Input
                label=""
                type="text"
                placeholder="Search by product name or code..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            {/* Size */}
            <div>
              <Select
                label="Size"
                value={sizeFilter}
                onChange={(e) =>
                  setSizeFilter(
                    e.target.value
                  )
                }
                options={[
                  {
                    label: "All Sizes",
                    value: "ALL",
                  },
                  ...categories.map(
                    (category) => ({
                      label: category,
                      value: category,
                    })
                  ),
                ]}
              />
            </div>

          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing{" "}
              {filteredProducts.length === 0
                ? 0
                : (currentPage - 1) *
                    PRODUCTS_PER_PAGE +
                  1}
              –
              {Math.min(
                currentPage *
                  PRODUCTS_PER_PAGE,
                filteredProducts.length
              )}{" "}
              of {filteredProducts.length}{" "}
              products
            </span>

            {sizeFilter !== "ALL" && (
              <span className="font-medium text-violet-600">
                {sizeFilter}
              </span>
            )}
          </div>

          {/* Table */}
          {paginatedProducts.length > 0 ? (
            <ProductTable
              products={paginatedProducts}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">

              <p className="text-sm font-medium text-slate-600">
                No products found.
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Try changing your search or
                size filter.
              </p>

            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

              <p className="text-sm text-slate-500">
                Page {currentPage} of{" "}
                {totalPages}
              </p>

              <div className="flex items-center justify-center gap-2">

                {/* Previous */}
                <button
                  type="button"
                  disabled={
                    currentPage === 1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {/* Page numbers */}
                {Array.from(
                  {
                    length: totalPages,
                  },
                  (_, index) =>
                    index + 1
                ).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() =>
                      setCurrentPage(page)
                    }
                    className={
                      page === currentPage
                        ? "rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white"
                        : "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    }
                  >
                    {page}
                  </button>
                ))}

                {/* Next */}
                <button
                  type="button"
                  disabled={
                    currentPage ===
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>

              </div>
            </div>
          )}

        </div>

        {/* Add / Edit Modal */}
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

        {/* Delete Confirmation */}
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