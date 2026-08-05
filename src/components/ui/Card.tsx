interface CardProps {
  title: string;
  value: string | number;
  description?: string;
}

export default function Card({
  title,
  value,
  description,
}: CardProps) {
  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:shadow-slate-900/5 hover:border-slate-300 hover:-translate-y-0.5">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <div className="relative">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <h3 className="text-3xl font-bold mt-2 text-slate-900 tabular-nums tracking-tight">
          {value}
        </h3>

        {description && (
          <p className="text-sm text-slate-400 mt-2 pt-2 border-t border-slate-100">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}