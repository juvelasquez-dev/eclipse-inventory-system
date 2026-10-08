import type { Transaction } from "../types/inventory";

const POS_SALE_PATTERN = /^POS sale (\S+)$/;
const POS_CANCELLATION_PATTERN = /^POS cancellation (\S+)$/;

function byDateThenOrder(
  a: { transaction: Transaction; index: number },
  b: { transaction: Transaction; index: number }
) {
  const diff =
    new Date(a.transaction.date).getTime() -
    new Date(b.transaction.date).getTime();
  return Number.isNaN(diff) || diff === 0 ? a.index - b.index : diff;
}

/**
 * Returns, per OUT transaction id, how much of its quantity was reversed by a
 * POS cancellation adjustment. A cancellation only reverses an earlier-or-same-time
 * "POS sale <receipt>" OUT for the same receipt and product, and never more than
 * that OUT's remaining quantity. Unmatched cancellations are ignored.
 */
export function getCancelledOutQuantities(
  transactions: Transaction[]
): Map<string, number> {
  const cancelled = new Map<string, number>();
  const salesByKey = new Map<
    string,
    { transaction: Transaction; index: number; remaining: number }[]
  >();
  const cancellations: { transaction: Transaction; index: number; key: string }[] = [];

  transactions.forEach((transaction, index) => {
    const remarks = transaction.remarks?.trim() ?? "";

    if (transaction.type === "OUT") {
      const receipt = POS_SALE_PATTERN.exec(remarks)?.[1];
      if (!receipt) return;
      const key = `${receipt}|${transaction.productId}`;
      const list = salesByKey.get(key) ?? [];
      list.push({ transaction, index, remaining: transaction.quantity });
      salesByKey.set(key, list);
      return;
    }

    if (transaction.type === "ADJUSTMENT" && transaction.quantity > 0) {
      const receipt = POS_CANCELLATION_PATTERN.exec(remarks)?.[1];
      if (receipt) {
        cancellations.push({
          transaction,
          index,
          key: `${receipt}|${transaction.productId}`,
        });
      }
    }
  });

  for (const list of salesByKey.values()) list.sort(byDateThenOrder);
  cancellations.sort(byDateThenOrder);

  for (const cancellation of cancellations) {
    let toReverse = cancellation.transaction.quantity;
    const cancellationTime = new Date(cancellation.transaction.date).getTime();

    for (const sale of salesByKey.get(cancellation.key) ?? []) {
      if (toReverse <= 0) break;
      if (sale.remaining <= 0) continue;
      if (new Date(sale.transaction.date).getTime() > cancellationTime) continue;

      const consumed = Math.min(sale.remaining, toReverse);
      sale.remaining -= consumed;
      toReverse -= consumed;
      cancelled.set(
        sale.transaction.id,
        (cancelled.get(sale.transaction.id) ?? 0) + consumed
      );
    }
  }

  return cancelled;
}

export function getNetOutQuantity(
  transaction: Transaction,
  cancelled: Map<string, number>
): number {
  return transaction.quantity - (cancelled.get(transaction.id) ?? 0);
}
