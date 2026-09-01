import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import MainLayout from "./components/layout/MainLayout";

import ProtectedRoute from "./components/auth/ProtectedRoute";

import Login from "./pages/Login/Login";
import System from "./pages/System/System";
import POS from "./pages/POS/POS";
import POSHistory from "./pages/POS/POSHistory";

import Dashboard from "./pages/Inventory/Dashboard";
import Products from "./pages/Inventory/Products";
import StockIn from "./pages/Inventory/StockIn";
import StockOut from "./pages/Inventory/StockOut";
import Inventory from "./pages/Inventory/Inventory";
import History from "./pages/Inventory/History";
import StockAdjustment from "./pages/Inventory/StockAdjustment";

import Outlets from "./pages/Outlets/Outlets";
import OutletDashboard from "./pages/Outlets/Dashboard";
import OutletReports from "./pages/Outlets/Reports";

import { ToastProvider } from "./context/ToastContext";
import { InventoryProvider } from "./context/InventoryContext";

function App() {
  return (
    <InventoryProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>

            {/* Authentication */}
            <Route
              path="/login"
              element={<Login />}
            />

            {/* Protected Application */}
            <Route element={<ProtectedRoute />}>

              {/* System Selection */}
              <Route
                path="/system"
                element={<System />}
              />

              {/* Inventory System */}
              <Route
                element={
                  <MainLayout module="inventory" />
                }
              >
                <Route
                  path="/"
                  element={<Dashboard />}
                />

                <Route
                  path="/products"
                  element={<Products />}
                />

                <Route
                  path="/stock-in"
                  element={<StockIn />}
                />

                <Route
                  path="/stock-out"
                  element={<StockOut />}
                />

                <Route
                  path="/inventory"
                  element={<Inventory />}
                />

                <Route
                  path="/history"
                  element={<History />}
                />

                <Route
                  path="/stock-adjustment"
                  element={<StockAdjustment />}
                />
              </Route>

              {/* POS System */}
              <Route
                element={
                  <MainLayout module="pos" />
                }
              >
                <Route
                  path="/pos"
                  element={<POS />}
                />

                <Route
                  path="/pos/history"
                  element={<POSHistory />}
                />
              </Route>

              {/* Outlet Management */}
              <Route
                element={
                  <MainLayout module="outlets" />
                }
              >
                <Route
                  path="/outlets/dashboard"
                  element={<OutletDashboard />}
                />

                <Route
                  path="/outlets"
                  element={<Outlets />}
                />

                <Route
                  path="/outlets/reports"
                  element={<OutletReports />}
                />
              </Route>

            </Route>

          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </InventoryProvider>
  );
}

export default App;