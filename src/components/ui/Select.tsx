import type { SelectHTMLAttributes } from "react";

interface Option {
  label: string;
  value: string;
}

interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
}

export default function Select({
  label,
  id,
  options,
  className = "",
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}

      <select
        id={id}
        {...props}
        className={`
          w-full
          appearance-none
          rounded-lg
          border
          border-slate-300
          bg-white
          bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2020%2020%27%20fill=%27%2394a3b8%27%3e%3cpath%20fill-rule=%27evenodd%27%20d=%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%27%20clip-rule=%27evenodd%27/%3e%3c/svg%3e')]
          bg-[length:1.15rem]
          bg-[right_0.6rem_center]
          bg-no-repeat
          px-3.5
          py-2.5
          pr-9
          text-sm
          text-slate-900
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
          ${className}
        `}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}