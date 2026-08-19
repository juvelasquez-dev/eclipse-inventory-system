import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import MainLayout from "./components/layout/MainLayout";

import ProtectedRoute from "./components/auth/ProtectedRoute";

import Login from "./pages/Login";
import System from "./pages/System";
import POS from "./pages/POS";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import StockIn from "./pages/StockIn";
import StockOut from "./pages/StockOut";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import StockAdjustment from "./pages/StockAdjustment";

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
              {/* POS */}
                <Route
                  path="/pos"
                  element={<POS />}
                />
              {/* Main Application */}
              <Route element={<MainLayout />}>

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

            </Route>

          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </InventoryProvider>
  );
}

export default App;