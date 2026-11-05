import assert from "node:assert/strict";
import test from "node:test";
import { balances, cents, settlements } from "../lib/money";

test("propõe transferências que zeram todos os saldos até o último centavo", () => {
  const totals = new Map([["a", 501], ["b", 200], ["c", -100], ["d", -601]]);
  const remaining = new Map(totals);
  for (const { from, to, cents } of settlements(totals)) {
    remaining.set(from, remaining.get(from)! + cents);
    remaining.set(to, remaining.get(to)! - cents);
  }
  assert.deepEqual([...remaining.values()], [0, 0, 0, 0]);
  assert.equal(totals.get("d"), -601);
});

test("rateia cada produto entre seus próprios consumidores", () => {
  assert.deepEqual([...balances(["a", "b", "c"], [{
    payer_id: "a", total_cents: 5000, items: [
      { amount_cents: 3000, consumers: ["a", "b"] },
      { amount_cents: 2000, consumers: ["b", "c"] },
    ],
  }]).values()], [3500, -2500, -1000]);
});

test("distribui centavos residuais de forma determinística", () => {
  assert.deepEqual([...balances(["a", "b", "c"], [{
    payer_id: "a", total_cents: 1000, items: [{ amount_cents: 1000, consumers: ["c", "b", "a"] }],
  }]).values()], [666, -333, -333]);
});

test("interpreta reais sem usar arredondamento de ponto flutuante", () => {
  assert.equal(cents("0,29"), 29);
  assert.throws(() => cents("1,999"));
});

test("distribui desconto explícito sem perder centavos", () => {
  assert.equal(cents("-0,01", true), -1);
  assert.deepEqual([...balances(["a", "b"], [{
    payer_id: "a", total_cents: 1999, items: [
      { amount_cents: 2000, consumers: ["a", "b"] },
      { amount_cents: -1, consumers: ["b", "a"] },
    ],
  }]).values()], [999, -999]);
});
