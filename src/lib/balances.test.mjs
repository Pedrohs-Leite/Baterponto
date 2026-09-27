import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dayBalance, signedHours } from "./balances.ts";
const sample = { employee_id: "test", entry_time: "2026-09-27T08:00:00-03:00", break_start: "2026-09-27T12:00:00-03:00", break_end: "2026-09-27T13:00:00-03:00", exit_time: "2026-09-27T17:00:00-03:00" };
test("8h desconta intervalo e calcula excedente ou déficit", () => {
  assert.equal(dayBalance(sample), 0);
  assert.equal(dayBalance({ ...sample, exit_time: "2026-09-27T17:30:00-03:00" }), 30);
  assert.equal(dayBalance({ ...sample, exit_time: "2026-09-27T16:30:00-03:00" }), -30);
});
test("4h sem intervalo e carga histórica preservada", () => {
  const half = { ...sample, break_start: null, break_end: null, exit_time: "2026-09-27T12:00:00-03:00" };
  assert.equal(dayBalance(half, "half"), 0);
  assert.equal(dayBalance({ ...half, expected_minutes: 240 }, "full"), 0);
});
test("abertas, intervalo incompleto e horários inválidos ficam pendentes", () => {
  assert.equal(dayBalance({ ...sample, exit_time: null }), null);
  assert.equal(dayBalance({ ...sample, break_end: null }), null);
  assert.equal(dayBalance({ ...sample, entry_time: "invalid" }), null);
  assert.equal(dayBalance({ ...sample, break_end: "2026-09-27T20:00:00-03:00" }), null);
});
test("formata saldos acumulados maiores que 24h", () => {
  assert.equal(signedHours(-1501), "− 25h 01min");
  assert.equal(signedHours(0), "+ 0h 00min");
});
