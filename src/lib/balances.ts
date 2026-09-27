export type Workday = {
  id?: string; employee_id: string; work_date?: string;
  entry_time: string | null; break_start: string | null;
  break_end: string | null; exit_time: string | null;
  expected_minutes?: number | null;
};

export function dayBalance(record: Workday, shift: "full" | "half" = "full"): number | null {
  if (!record.entry_time || !record.exit_time) return null;
  const start = Date.parse(record.entry_time), end = Date.parse(record.exit_time);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  if (Boolean(record.break_start) !== Boolean(record.break_end)) return null;
  let pause = 0;
  if (record.break_start && record.break_end) {
    const a = Date.parse(record.break_start), b = Date.parse(record.break_end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < start || b < a || b > end) return null;
    pause = b - a;
  }
  return Math.round((end - start - pause) / 60000) - (record.expected_minutes ?? (shift === "half" ? 240 : 480));
}

export function signedHours(minutes: number): string {
  return `${minutes < 0 ? "−" : "+"} ${Math.floor(Math.abs(minutes) / 60)}h ${String(Math.abs(minutes) % 60).padStart(2, "0")}min`;
}
