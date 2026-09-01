import { useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

import type {
  Outlet,
  OutletStatus,
} from "../../types/inventory";

export interface OutletFormData {
  outletName: string;
  contactPerson: string;
  contactNumber: string;
  completeAddress: string;
  areaCode: string;
  tin: string;
  status: OutletStatus;
}

interface OutletFormProps {
  initialValues?: Outlet;
  externalError?: string;
  onClearError?: () => void;
  onSubmit: (data: OutletFormData) => void;
}

export default function OutletForm({
  initialValues,
  externalError,
  onClearError,
  onSubmit,
}: OutletFormProps) {
  const [outletName, setOutletName] = useState(
    initialValues?.outletName ?? ""
  );

  const [contactPerson, setContactPerson] =
    useState(
      initialValues?.contactPerson ?? ""
    );

  const [contactNumber, setContactNumber] =
    useState(
      initialValues?.contactNumber ?? ""
    );

  const [completeAddress, setCompleteAddress] =
    useState(
      initialValues?.completeAddress ?? ""
    );

  const [areaCode, setAreaCode] = useState(
    initialValues?.areaCode ?? ""
  );

  const [tin, setTin] = useState(
    initialValues?.tin ?? ""
  );

  const [status, setStatus] =
    useState<OutletStatus>(
      initialValues?.status ?? "Active"
    );

  const [error, setError] = useState("");
  const displayError = externalError || error;

  function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!outletName.trim()) {
      setError("Outlet name is required.");
      return;
    }

    if (!contactPerson.trim()) {
      setError("Contact person is required.");
      return;
    }

    if (!contactNumber.trim()) {
      setError("Contact number is required.");
      return;
    }

    if (!completeAddress.trim()) {
      setError("Complete address is required.");
      return;
    }

    if (!areaCode) {
      setError("Area code is required.");
      return;
    }

    setError("");
    onClearError?.();

    onSubmit({
      outletName: outletName.trim(),
      contactPerson: contactPerson.trim(),
      contactNumber: contactNumber.trim(),
      completeAddress:
        completeAddress.trim(),
      areaCode,
      tin: tin.trim(),
      status,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {displayError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Outlet Name */}
        <div className="sm:col-span-2">
          <Input
            label="Outlet Name"
            value={outletName}
            onChange={(e) => {
              setOutletName(e.target.value);
              setError("");
              onClearError?.();
            }}
            placeholder="Enter outlet name"
          />
        </div>

        {/* Contact Person */}
        <Input
          label="Contact Person"
          value={contactPerson}
          onChange={(e) => {
            setContactPerson(e.target.value);
            setError("");
            onClearError?.();
          }}
          placeholder="Enter contact person"
        />

        {/* Contact Number */}
        <Input
          label="Contact Number"
          value={contactNumber}
          onChange={(e) => {
            setContactNumber(e.target.value);
            setError("");
            onClearError?.();
          }}
          placeholder="e.g. 09123456789"
        />

        {/* Complete Address */}
        <div className="sm:col-span-2">
          <Input
            label="Complete Address"
            value={completeAddress}
            onChange={(e) => {
              setCompleteAddress(
                e.target.value
              );
              setError("");
              onClearError?.();
            }}
            placeholder="Enter complete address"
          />
        </div>

        {/* Area Code */}
        <Select
          label="Area"
          value={areaCode}
          onChange={(e) => {
            setAreaCode(e.target.value);
            setError("");
            onClearError?.();
          }}
          options={[
            {
              label: "Select Area",
              value: "",
            },
            {
              label: "IAO",
              value: "IAO",
            },
            {
              label: "CBR",
              value: "CBR",
            },
            {
              label: "EFT",
              value: "EFT",
            },
          ]}
        />

        {/* TIN */}
        <Input
          label="TIN"
          value={tin}
          onChange={(e) => {
            setTin(e.target.value);
            setError("");
            onClearError?.();
          }}
          placeholder="Enter TIN"
        />

        {/* Status */}
        <Select
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(
              e.target.value as OutletStatus
            );
            onClearError?.();
          }}
          options={[
            {
              label: "Active",
              value: "Active",
            },
            {
              label: "Inactive",
              value: "Inactive",
            },
          ]}
        />

      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button type="submit">
          Save Outlet
        </Button>
      </div>
    </form>
  );
}