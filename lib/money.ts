export function cents(input: string, allowNegative = false): number {
  const text = input.trim();
  const negative = allowNegative && text.startsWith("-");
  const value = negative ? text.slice(1) : text;
  if (!/^\d{1,7}(?:[,.]\d{1,2})?$/.test(value)) throw new Error("Informe um valor em reais, como 12,50.");
  const [whole, fraction = ""] = value.split(/[,.]/);
  return (negative ? -1 : 1) * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
}

export const brl = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

export type SplitItem = { amount_cents: number; consumers: string[] };
export type SplitExpense = { payer_id: string; total_cents: number; items: SplitItem[] };

export function balances(memberIds: string[], expenses: SplitExpense[]) {
  const result = new Map(memberIds.map(id => [id, 0]));
  const add = (id: string, value: number) => result.set(id, (result.get(id) ?? 0) + value);
  for (const expense of expenses) {
    add(expense.payer_id, expense.total_cents);
    for (const item of expense.items) {
      const ids = [...item.consumers].sort();
      const base = Math.floor(item.amount_cents / ids.length);
      const remainder = item.amount_cents - base * ids.length;
      ids.forEach((id, index) => add(id, -(base + Number(index < remainder))));
    }
  }
  return result;
}

export function settlements(totals: ReadonlyMap<string, number>) {
  const debtors = [...totals].filter(([, amount]) => amount < 0)
    .map(([id, amount]) => ({ id, remaining: -amount }));
  const creditors = [...totals].filter(([, amount]) => amount > 0)
    .map(([id, amount]) => ({ id, remaining: amount }));
  debtors.sort((a, b) => b.remaining - a.remaining || a.id.localeCompare(b.id));
  creditors.sort((a, b) => b.remaining - a.remaining || a.id.localeCompare(b.id));

  const transfers: { from: string; to: string; cents: number }[] = [];
  let receiver = 0;
  for (const debtor of debtors) {
    while (debtor.remaining > 0 && receiver < creditors.length) {
      const creditor = creditors[receiver];
      const amount = Math.min(debtor.remaining, creditor.remaining);
      transfers.push({ from: debtor.id, to: creditor.id, cents: amount });
      debtor.remaining -= amount;
      creditor.remaining -= amount;
      if (creditor.remaining === 0) receiver++;
    }
  }
  return transfers;
}
