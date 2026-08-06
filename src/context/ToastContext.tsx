import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error";

interface Toast {
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType
  ) => void;
}

const ToastContext =
  createContext<ToastContextType | null>(null);

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [toast, setToast] =
    useState<Toast | null>(null);

  function showToast(
    message: string,
    type: ToastType = "success"
  ) {
    setToast({
      message,
      type,
    });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  return (
    <ToastContext.Provider
      value={{ showToast }}
    >
      {children}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-[100] rounded-xl px-5 py-3 text-white shadow-lg transition-all
            ${
              toast.type === "success"
                ? "bg-emerald-600"
                : "bg-red-600"
            }`}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context =
    useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast must be used inside ToastProvider."
    );
  }

  return context;
}