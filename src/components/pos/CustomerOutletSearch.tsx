import { useEffect, useMemo, useRef, useState } from "react";
import Input from "../ui/Input";
import type { Outlet } from "../../types/inventory";

interface CustomerOutletSearchProps {
  outlets: Outlet[];
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  selectedOutlet: Outlet | null;
  onSelectOutlet: (outlet: Outlet) => void;
  onClearOutlet: () => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerAddressChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  disabled?: boolean;
}

export default function CustomerOutletSearch({
  outlets,
  customerName,
  customerAddress,
  customerPhone,
  selectedOutlet,
  onSelectOutlet,
  onClearOutlet,
  onCustomerNameChange,
  onCustomerAddressChange,
  onCustomerPhoneChange,
  disabled = false,
}: CustomerOutletSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter matching active outlets (at least 2 chars)
  const suggestions = useMemo(() => {
    const query = customerName.trim().toLowerCase();
    if (query.length < 2 || selectedOutlet) {
      return [];
    }

    return outlets
      .filter((outlet) => {
        const status = String(outlet.status ?? "").trim().toLowerCase();

        if (status !== "active") {
          return false;
        }

        const nameMatch =
          outlet.outletName?.toLowerCase().includes(query) ?? false;
        const contactMatch =
          outlet.contactPerson?.toLowerCase().includes(query) ?? false;
        const addressMatch =
          outlet.completeAddress?.toLowerCase().includes(query) ?? false;
        const degicMatch =
          outlet.degicNumber?.toLowerCase().includes(query) ?? false;

        return nameMatch || contactMatch || addressMatch || degicMatch;
      })
      .slice(0, 8);
  }, [customerName, outlets, selectedOutlet]);

  function handleInputChange(value: string) {
    onCustomerNameChange(value);
    if (selectedOutlet) {
      onClearOutlet();
    }
    setIsOpen(true);
  }

  function handleSelectSuggestion(outlet: Outlet) {
    onSelectOutlet(outlet);
    setIsOpen(false);
  }

  function handleClear() {
    onClearOutlet();
    setIsOpen(false);
  }

  const hasIdInfo =
    Boolean(selectedOutlet?.idType?.trim()) ||
    Boolean(selectedOutlet?.idNumber?.trim());

  const formattedId = hasIdInfo
    ? [selectedOutlet?.idType?.trim(), selectedOutlet?.idNumber?.trim()]
        .filter(Boolean)
        .join(" - ")
    : "—";

  return (
    <div className="space-y-4">
      {/* Search / Customer Name Field */}
      <div ref={containerRef} className="relative z-30">
        <div className="flex items-center justify-between">
          <label
            htmlFor="pos-customer-name"
            className="block text-sm font-medium text-slate-700"
          >
            Customer / Outlet Name
          </label>
          {selectedOutlet ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Verified Outlet
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
              Manual / Walk-in
            </span>
          )}
        </div>

        <div className="relative mt-1.5">
          <input
            id="pos-customer-name"
            type="text"
            placeholder="Type outlet name, contact, or DEGIC..."
            value={customerName}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (customerName.trim().length >= 2 && !selectedOutlet) {
                setIsOpen(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              }
            }}
            disabled={disabled}
            autoComplete="off"
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
              focus:border-emerald-500
              focus:ring-4
              focus:ring-emerald-100
              disabled:cursor-not-allowed
              disabled:bg-slate-50
              disabled:text-slate-400
            "
          />

          {selectedOutlet && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
            >
              Change
            </button>
          )}

          {/* Autocomplete Suggestions Dropdown */}
          {isOpen && suggestions.length > 0 && !selectedOutlet && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Matching Outlets ({suggestions.length})
              </div>
              {suggestions.map((outlet) => (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(outlet)}
                  className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-emerald-50/80 focus:bg-emerald-50 focus:outline-none"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 text-sm">
                      {outlet.outletName}
                    </span>
                    {outlet.areaCode && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {outlet.areaCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {outlet.contactPerson && (
                      <span>Contact: {outlet.contactPerson}</span>
                    )}
                    {outlet.contactPerson && outlet.completeAddress && (
                      <span>•</span>
                    )}
                    {outlet.completeAddress && (
                      <span className="truncate max-w-[280px]">
                        {outlet.completeAddress}
                      </span>
                    )}
                    {outlet.degicNumber && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">
                          DEGIC: {outlet.degicNumber}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {isOpen &&
            customerName.trim().length >= 2 &&
            suggestions.length === 0 &&
            !selectedOutlet && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-slate-200 bg-white p-3 text-center text-xs text-slate-500 shadow-xl">
                No matching active outlets found. Proceeding with manual customer entry.
              </div>
            )}
        </div>
      </div>

      {/* Selected Outlet Details Card (Read-only) */}
      {selectedOutlet ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Outlet Information
            </h4>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
            >
              Clear / Switch to Manual
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
            <div>
              <span className="text-slate-500">Contact Person:</span>{" "}
              <span className="font-semibold text-slate-800">
                {selectedOutlet.contactPerson || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Contact Number:</span>{" "}
              <span className="font-semibold text-slate-800">
                {selectedOutlet.contactNumber || "—"}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500">Complete Address:</span>{" "}
              <span className="font-semibold text-slate-800">
                {selectedOutlet.completeAddress || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Area Code:</span>{" "}
              <span className="font-semibold text-slate-800">
                {selectedOutlet.areaCode || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">DEGIC Number:</span>{" "}
              <span className="font-semibold text-slate-800">
                {selectedOutlet.degicNumber || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">TIN:</span>{" "}
              <span className="font-semibold text-slate-800">
                {selectedOutlet.tin || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">ID Details:</span>{" "}
              <span className="font-semibold text-slate-800">
                {formattedId}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Address & Phone Inputs */}
      <Input
        label="Address"
        type="text"
        placeholder="Enter customer address"
        value={customerAddress}
        onChange={(event) => onCustomerAddressChange(event.target.value)}
        disabled={disabled}
      />

      <Input
        label="Phone"
        type="tel"
        placeholder="Enter phone number"
        value={customerPhone}
        onChange={(event) => onCustomerPhoneChange(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
