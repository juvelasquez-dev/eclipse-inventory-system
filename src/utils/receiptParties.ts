import type { Outlet } from "../types/inventory";

export interface ReceiptParties {
  outletName: string;
  contactPerson: string;
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

/*
 * POS transactions store the selected outlet's name in customer_name and do
 * not store the contact person. The contact person is resolved from the
 * outlet record with the same name (and address when names are duplicated).
 */
export function resolveReceiptParties(
  receipt: { customerName: string; customerAddress: string },
  outlets: Outlet[]
): ReceiptParties {
  const outletName = receipt.customerName.trim();
  const sameName = outlets.filter(
    (outlet) => normalize(outlet.outletName) === normalize(outletName)
  );
  const outlet =
    sameName.length > 1
      ? sameName.find(
          (candidate) =>
            normalize(candidate.completeAddress) ===
            normalize(receipt.customerAddress)
        )
      : sameName[0];

  return {
    outletName,
    contactPerson: outlet?.contactPerson?.trim() ?? "",
  };
}
