import { useState } from "react";

import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";

import {
  OUTLET_ID_TYPE_OPTIONS,
  type Outlet,
  type OutletStatus,
} from "../../types/inventory";
import {
  validateOutletIdentification,
} from "../../utils/outlets";

export interface OutletFormData {
  outletName: string;
  contactPerson: string;
  degicNumber: string;
  contactNumber: string;
  completeAddress: string;
  areaCode: string;
  tin?: string;
  idType?: string;
  idNumber?: string;
  status: OutletStatus;
}

interface OutletFormProps {
  initialValues?: Outlet;
  externalError?: string;
  isSubmitting?: boolean;
  onClearError?: () => void;
  onSubmit: (data: OutletFormData) => void;
}

export default function OutletForm({
  initialValues,
  externalError,
  isSubmitting,
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

  const [degicNumber, setDegicNumber] =
    useState(
      initialValues?.degicNumber ?? ""
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

  const [idType, setIdType] = useState(
    initialValues?.idType ?? ""
  );

  const [idNumber, setIdNumber] = useState(
    initialValues?.idNumber ?? ""
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

    const identificationError = validateOutletIdentification({
      tin,
      idType,
      idNumber,
    });

    if (identificationError) {
      setError(identificationError);
      return;
    }

    setError("");
    onClearError?.();

    onSubmit({
      outletName: outletName.trim(),
      contactPerson: contactPerson.trim(),
      degicNumber: degicNumber.trim(),
      contactNumber: contactNumber.trim(),
      completeAddress:
        completeAddress.trim(),
      areaCode,
      tin: tin.trim(),
      idType: idType.trim(),
      idNumber: idNumber.trim(),
      status,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {displayError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            <Input
              label="DEGIC Number"
              value={degicNumber}
              onChange={(e) => {
                setDegicNumber(e.target.value);
                setError("");
                onClearError?.();
              }}
              placeholder="Enter DEGIC number"
            />

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
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Location
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Complete Address"
                value={completeAddress}
                onChange={(e) => {
                  setCompleteAddress(e.target.value);
                  setError("");
                  onClearError?.();
                }}
                placeholder="Enter complete address"
              />
            </div>

            <Select
              label="Area"
              value={areaCode}
              onChange={(e) => {
                setAreaCode(e.target.value);
                setError("");
                onClearError?.();
              }}
              options={[
                { label: "Select Area", value: "" },
                { label: "IAO", value: "IAO" },
                { label: "CBR", value: "CBR" },
                { label: "EFT", value: "EFT" },
              ]}
            />

          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Identification
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
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
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                <span>OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            </div>

            <Select
              label="ID Type"
              value={idType}
              onChange={(e) => {
                setIdType(e.target.value);
                setError("");
                onClearError?.();
              }}
              options={OUTLET_ID_TYPE_OPTIONS.map(
                (option) => ({
                  label: option,
                  value: option === "Select ID Type" ? "" : option,
                })
              )}
            />

            <Input
              label="ID Number"
              value={idNumber}
              onChange={(e) => {
                setIdNumber(e.target.value);
                setError("");
                onClearError?.();
              }}
              placeholder="Enter ID number"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Status
          </h3>
          <div className="max-w-xs">
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
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Outlet"}
        </Button>
      </div>
    </form>
  );
}