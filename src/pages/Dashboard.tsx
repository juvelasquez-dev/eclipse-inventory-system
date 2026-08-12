import { useInventory } from "../hooks/useInventory";

export default function Dashboard() {
  const {
    totalProducts,
    totalStock,
    stockInToday,
    stockOutToday,
    inventory,
  } = useInventory();


  const lowStockProducts =
    inventory.filter(
      (product) =>
        product.stock <= product.minimumStock
    );


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">


        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-8">

          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 opacity-60 blur-2xl" />

          <div className="relative">

            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
              Overview
            </span>

            <h1 className="mt-4 text-4xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Monitor your inventory activity.
            </p>

          </div>

        </div>



        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">


          <SummaryCard
            title="Total Products"
            value={totalProducts}
          />


          <SummaryCard
            title="Total Stock"
            value={totalStock}
          />


          <SummaryCard
            title="Stock In Today"
            value={stockInToday}
          />


          <SummaryCard
            title="Stock Out Today"
            value={stockOutToday}
          />


        </div>



        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">

          <div className="flex items-center justify-between mb-5">

            <h2 className="text-lg font-semibold text-slate-900">
              Low Stock Alert
            </h2>

            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              {lowStockProducts.length} items
            </span>

          </div>



          {lowStockProducts.length === 0 ? (

            <p className="text-sm text-slate-500">
              No low stock products.
            </p>

          ) : (

            <div className="space-y-3">

              {lowStockProducts.map(
                (product) => (

                  <div
                    key={product.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                  >

                    <div>

                      <p className="font-medium text-slate-900">
                        {product.name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {product.code}
                      </p>

                    </div>


                    <div className="text-right">

                      <p className="font-semibold text-red-600">
                        {product.stock} {product.unit}
                      </p>

                      <p className="text-xs text-slate-500">
                        Minimum: {product.minimumStock}
                      </p>

                    </div>


                  </div>

                )
              )}

            </div>

          )}

        </div>


      </div>

    </div>
  );
}



function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-3xl font-bold text-slate-900">
        {value}
      </p>

    </div>
  );
}