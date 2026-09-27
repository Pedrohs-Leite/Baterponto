"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { dayBalance, signedHours, type Workday } from "@/lib/balances";
import styles from "./admin.module.css";

type Person = { id: string; name: string; role: string; shift_type: "full" | "half" };
type Adjustment = { id: string; employee_id: string; minutes: number; reason: string; created_at: string };
const dateText = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza" }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value));

// Paginação explícita para não limitar o saldo ao primeiro lote do Supabase.
async function readAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).order(order).range(offset, offset + 499);
    if (error) throw error;
    const page = (data ?? []) as unknown as T[];
    all.push(...page);
    if (page.length < 500) return all;
  }
}

export default function Balances() {
  const [people, setPeople] = useState<Person[]>([]);
  const [days, setDays] = useState<Workday[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [direction, setDirection] = useState("credit");
  const [hours, setHours] = useState("0"), [minutes, setMinutes] = useState("0"), [reason, setReason] = useState("");
  const [formError, setFormError] = useState(""), [saving, setSaving] = useState(false);
  const savingRef = useRef(false), requestId = useRef("");
  const refreshing = useRef(false);

  const load = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const [staff, records] = await Promise.all([
        readAll<Person>("employees", "id,name,role,shift_type", "id"),
        readAll<Workday>("time_records", "id,employee_id,work_date,entry_time,break_start,break_end,exit_time,expected_minutes", "id"),
      ]);
      const entries = await readAll<Adjustment>("balance_adjustments", "id,employee_id,minutes,reason,created_at", "id");
      setPeople(staff); setDays(records); setAdjustments(entries); setReady(true); setError("");
    } catch (err) {
      setReady(false);
      const code = (err as { code?: string }).code;
      setError(["42703", "42P01", "PGRST204", "PGRST205"].includes(code ?? "")
        ? "Falta ativar os saldos no banco. Execute o arquivo 20260927_balances.sql no SQL Editor e clique em Atualizar."
        : "Não foi possível atualizar os saldos. Verifique a conexão e tente novamente.");
    } finally { setLoading(false); refreshing.current = false; }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    return () => { clearTimeout(first); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  const rows = useMemo(() => people.map(person => {
    const records = days.filter(d => d.employee_id === person.id);
    const values = records.map(d => dayBalance(d, person.shift_type));
    const automatic = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const manual = adjustments.filter(a => a.employee_id === person.id).reduce((sum, a) => sum + a.minutes, 0);
    return { person, automatic, manual, total: automatic + manual, pending: values.filter(v => v === null).length };
  }), [people, days, adjustments]);
  const visible = rows.filter(r => `${r.person.name} ${r.person.role}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const person = people.find(p => p.id === selected);
  const history = person ? [
    ...days.filter(d => d.employee_id === person.id).map(d => ({ id: d.id!, date: d.work_date!, description: `Jornada · ${(d.expected_minutes ?? (person.shift_type === "half" ? 240 : 480)) / 60}h previstas`, value: dayBalance(d, person.shift_type), type: "Automático" })),
    ...adjustments.filter(a => a.employee_id === person.id).map(a => ({ id: a.id, date: a.created_at, description: a.reason, value: a.minutes, type: "Ajuste manual" })),
  ].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const amount = (Number(hours) * 60 + Number(minutes)) * (direction === "credit" ? 1 : -1);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || savingRef.current || !ready) return;
    if (!/^\d+$/.test(hours) || !/^\d+$/.test(minutes) || Number(minutes) > 59 || Math.abs(amount) === 0 || Math.abs(amount) > 60000 || reason.trim().length < 3) {
      setFormError("Informe uma duração maior que zero (até 1.000h), minutos de 0 a 59 e um motivo de pelo menos 3 caracteres."); return;
    }
    savingRef.current = true; setSaving(true); setFormError("");
    try {
      const entry = { id: requestId.current, employee_id: editing.id, minutes: amount, reason: reason.trim() };
      const { data, error: insertError } = await supabase.from("balance_adjustments").insert(entry).select("id,employee_id,minutes,reason,created_at").single();
      if (insertError) {
        // Uma repetição após perda de conexão não duplica o lançamento.
        if (insertError.code === "23505") { await load(); setEditing(null); return; }
        setFormError("O ajuste não foi confirmado. Verifique a conexão e as permissões e tente novamente."); return;
      }
      setAdjustments(current => [...current.filter(a => a.id !== data.id), data]);
      setSelected(editing.id); setEditing(null); void load();
    } catch { setFormError("Falha de conexão. Tente novamente para confirmar o lançamento."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <section>
    <header className={styles.hero}><div><p className={styles.kicker}>Banco de horas</p><h1>Saldos da equipe.</h1><p className={styles.heroSub}>Jornadas encerradas + ajustes manuais, em todo o histórico.</p></div><button className={styles.addButton} onClick={() => void load()}>Atualizar</button></header>
    {error && <div role="alert" className={styles.notice}>{error}</div>}
    {loading ? <p role="status">Carregando saldos…</p> : ready && <>
      <div className={styles.metrics}>{[["Créditos", rows.reduce((s,r) => s + Math.max(r.total,0),0)], ["Débitos", rows.reduce((s,r) => s + Math.min(r.total,0),0)], ["Saldo coletivo", rows.reduce((s,r) => s+r.total,0)]].map(([title, value]) => <article key={title} className={styles.metric}><span className={styles.metricTop}>{title}</span><strong className={styles.metricValue}>{signedHours(Number(value))}</strong></article>)}</div>
      <p className={styles.teamHint}>Atualização automática a cada 15 segundos. Jornadas incompletas ou com horários inconsistentes ficam pendentes. Dias sem registros não geram desconto automático.</p>
      <section className={styles.records}><header className={styles.recordsHead}><h2>Saldo por funcionário</h2><label className={styles.search}><input aria-label="Buscar funcionário nos saldos" placeholder="Buscar funcionário" value={search} onChange={e => setSearch(e.target.value)} /></label></header><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Funcionário</th><th>Jornadas</th><th>Ajustes</th><th>Saldo final</th><th>Ações</th></tr></thead><tbody>{visible.map(row => <tr key={row.person.id}><td><b>{row.person.name}</b><div>{row.person.role}</div>{row.pending > 0 && <small>{row.pending} jornada(s) pendente(s)</small>}</td><td>{signedHours(row.automatic)}</td><td>{signedHours(row.manual)}</td><td className={row.total < 0 ? styles.negative : styles.positive}><b>{signedHours(row.total)}</b></td><td><div className={styles.balanceActions}><button onClick={() => setSelected(row.person.id)}>Histórico</button><button onClick={() => { setEditing(row.person); setHours("0"); setMinutes("0"); setDirection("credit"); setReason(""); setFormError(""); requestId.current = crypto.randomUUID(); }}>Ajustar saldo</button></div></td></tr>)}</tbody></table>{!visible.length && <p className={styles.empty}>Nenhum funcionário encontrado.</p>}</div></section>
      {person && <section className={styles.records}><header className={styles.recordsHead}><h2>Histórico · {person.name}</h2><button className={styles.cancelButton} onClick={() => setSelected("")}>Fechar histórico</button></header><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Data</th><th>Origem</th><th>Descrição / motivo</th><th>Saldo</th></tr></thead><tbody>{history.map(item => <tr key={item.id}><td>{dateText(item.date)}</td><td>{item.type}</td><td className={styles.balanceReason}>{item.description}</td><td>{item.value === null ? "Pendente" : signedHours(item.value)}</td></tr>)}</tbody></table>{!history.length && <p className={styles.empty}>Nenhuma movimentação para este funcionário.</p>}</div></section>}
    </>}
    {editing && <div className={styles.overlay}><form className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="adjust-title" onSubmit={save}><div className={styles.modalBand}/><div className={styles.modalBody}><h2 id="adjust-title">Ajustar saldo</h2><p>{editing.name}</p><fieldset disabled={saving} className={styles.adjustFields}><div className={styles.field}><label htmlFor="adjust-kind">Tipo de ajuste</label><select id="adjust-kind" value={direction} onChange={e => setDirection(e.target.value)}><option value="credit">Adicionar horas (crédito)</option><option value="debit">Descontar horas (débito)</option></select></div><div className={styles.balanceActions}><div className={styles.field}><label htmlFor="adjust-hours">Horas</label><input id="adjust-hours" type="number" min="0" max="1000" required value={hours} onChange={e => setHours(e.target.value)}/></div><div className={styles.field}><label htmlFor="adjust-minutes">Minutos</label><input id="adjust-minutes" type="number" min="0" max="59" required value={minutes} onChange={e => setMinutes(e.target.value)}/></div></div><div className={styles.field}><label htmlFor="adjust-reason">Motivo obrigatório</label><textarea id="adjust-reason" minLength={3} maxLength={500} required value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: compensação de horas combinada com o funcionário"/></div><p className={styles.teamHint}>Variação: {Number.isFinite(amount) ? signedHours(amount) : "—"}. O lançamento será preservado no histórico.</p></fieldset>{formError && <p role="alert" className={styles.notice}>{formError}</p>}<div className={styles.modalActions}><button type="button" disabled={saving} className={styles.cancelButton} onClick={() => setEditing(null)}>Cancelar</button><button disabled={saving || !ready} className={styles.saveButton}>{saving ? "Salvando…" : "Confirmar ajuste"}</button></div></div></form></div>}
  </section>;
}
