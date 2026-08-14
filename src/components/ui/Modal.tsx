import { X } from "lucide-react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({
  open,
  title,
  onClose,
  children,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}