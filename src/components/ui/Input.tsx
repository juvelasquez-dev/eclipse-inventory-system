import type { InputHTMLAttributes } from "react";

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function Input({
  label,
  id,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>

      <input
        id={id}
        {...props}
        className="
          w-full
          rounded-lg
          border
          border-slate-300
          bg-white
          px-3.5
          py-2.5
          text-sm
          text-slate-900
          placeholder:text-slate-400
          shadow-sm
          outline-none
          transition-all
          duration-150
          hover:border-slate-400
          focus:border-blue-500
          focus:ring-4
          focus:ring-blue-100
          disabled:cursor-not-allowed
          disabled:bg-slate-50
          disabled:text-slate-400
          disabled:hover:border-slate-300
        "
      />
    </div>
  );
}