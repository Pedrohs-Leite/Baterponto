"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./admin.module.css";
import Team from "./team";
import Balances from "./balances";
import { dayBalance } from "@/lib/balances";

type Employee = { id: string; name: string; role: string; shift_type: "full" | "half" };
type Record = { employee_id: string; entry_time: string | null; break_start: string | null; break_end: string | null; exit_time: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const time = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

function balance(record?: Record, shift: "full" | "half" = "full") {
  if (!record?.entry_time) return "—";
  if (!record.exit_time) return "Em curso";
  const minutes = dayBalance(record, shift);
  if (minutes === null) return "Pendente";
  return `${minutes >= 0 ? "+" : "−"} ${String(Math.abs(minutes)).padStart(2, "0")} min`;
}

export default function Admin() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pin, setPin] = useState("");
  const [shiftType, setShiftType] = useState<"full" | "half">("full");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [section, setSection] = useState<"overview" | "team" | "balances">("overview");

  async function load() {
    const [employeeResult, recordResult] = await Promise.all([
      supabase.from("employees").select("id,name,role,shift_type").eq("active", true).order("name"),
      supabase.from("time_records").select("employee_id,entry_time,break_start,break_end,exit_time").eq("work_date", today()),
    ]);
    if (employeeResult.error || recordResult.error) {
      setNotice("Conecte o Supabase para visualizar a operação em tempo real.");
    }
    if (!employeeResult.error) setEmployees(employeeResult.data ?? []);
    if (!recordResult.error) setRecords(recordResult.data ?? []);
  }

  useEffect(() => { const id = setTimeout(() => void load(), 0); return () => clearTimeout(id); }, []);

  const rows = useMemo(() => employees.filter((employee) => employee.name.toLowerCase().includes(query.toLowerCase())).map((employee) => ({ employee, record: records.find((item) => item.employee_id === employee.id) })), [employees, records, query]);

  async function save() {
    if (!name.trim() || pin.length !== 3) return;
    const { error } = await supabase.from("employees").insert({ name: name.trim(), role: role.trim() || "Colaborador", pin, shift_type: shiftType });
    if (error) { setNotice("Não foi possível salvar. Confirme se o PIN já está em uso."); return; }
    setOpen(false); setName(""); setRole(""); setPin(""); setShiftType("full"); setNotice("Funcionário adicionado. O novo PIN já está disponível no totem."); void load();
  }

  const present = records.filter((record) => record.entry_time).length;
  const working = records.filter((record) => record.entry_time && !record.exit_time).length;
  const total = records.reduce((sum, record) => {
    const value = balance(record, employees.find(e => e.id === record.employee_id)?.shift_type);
    const minutes = Number(value.match(/\d+/)?.[0] ?? 0);
    return sum + (value.startsWith("+") ? minutes : value.startsWith("−") ? -minutes : 0);
  }, 0);

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${mobileNavOpen ? styles.mobileOpen : ""}`}>
          <div className={styles.brand}><Image src="/logo-convida.png" width={1920} height={1920} alt="Convida" priority /></div>
          <div className={styles.workspace}><small>Unidade atual</small><strong>Matriz · Convida</strong></div>
          <nav className={styles.nav} aria-label="Navegação principal">
            <NavItem active={section === "overview"} onClick={() => { setSection("overview"); setMobileNavOpen(false); }} icon={<GridIcon />} label="Visão geral" />
            <NavItem icon={<ClockIcon />} label="Jornadas" />
            <NavItem active={section === "balances"} onClick={() => { setSection("balances"); setMobileNavOpen(false); }} icon={<TrendIcon />} label="Saldos da equipe" />
            <NavItem active={section === "team"} onClick={() => { setSection("team"); setMobileNavOpen(false); }} icon={<PeopleIcon />} label="Equipe" />
          </nav>
          <div className={styles.sidebarFoot}>
            <div className={styles.adminIdentity}><span className={styles.avatar}>AD</span><div><b>Administrador</b><span>Gestão de pessoas</span></div></div>
            <p className={styles.version}>Convida · 20 anos</p>
            <button className={styles.closeMenu} onClick={() => setMobileNavOpen(false)}>Fechar menu</button>
          </div>
        </aside>

        <div className={styles.content}>
          <div className={styles.mobileHeader}><div className={styles.mobileBrand}><Image src="/logo-convida.png" width={1920} height={1920} alt="Convida" /></div><button className={styles.mobileMenu} aria-label="Abrir menu" onClick={() => setMobileNavOpen(true)}><MenuIcon /></button></div>
          <header className={styles.topbar}>
            <p className={styles.breadcrumb}>Convida <span> / </span> <b>Controle de ponto</b></p>
            <div className={styles.topActions}><button className={styles.iconButton} aria-label="Notificações"><BellIcon /></button><span className={styles.datePill}>{dateLabel}</span></div>
          </header>

          {section === "balances" ? <Balances /> : section === "team" ? <Team employees={employees} onAdd={() => setOpen(true)} /> : <>
          <section className={styles.hero}>
            <div><p className={styles.kicker}>Centro de comando</p><h1>O pulso da equipe.</h1><p className={styles.heroSub}>Acompanhe a jornada de hoje sem perder o ritmo.</p></div>
            <button className={styles.addButton} onClick={() => setOpen(true)}><PlusIcon /><span>Novo funcionário</span></button>
          </section>

          {notice && <div className={styles.notice} role="status">{notice}</div>}

          <section className={styles.metrics} aria-label="Indicadores do dia">
            <Metric featured label="Equipe ativa" value={String(employees.length).padStart(2, "0")} meta="pessoas cadastradas" icon={<PeopleIcon />} />
            <Metric label="Presentes" value={String(present).padStart(2, "0")} meta="registros hoje" icon={<CheckCircleIcon />} />
            <Metric label="Em jornada" value={String(working).padStart(2, "0")} meta="agora" icon={<PulseIcon />} />
            <Metric label="Saldo coletivo" value={`${total >= 0 ? "+" : "−"} ${Math.abs(total)}m`} meta="acumulado do dia" icon={<TrendIcon />} />
          </section>

          <section className={styles.records}>
            <header className={styles.recordsHead}>
              <div className={styles.recordsTitle}><span className={styles.recordsMark}><ClockIcon /></span><div><h2>Ritmo de hoje</h2><p>{dateLabel} · acompanhamento ao vivo</p></div></div>
              <label className={styles.search}><SearchIcon /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na equipe" aria-label="Buscar funcionário" /></label>
            </header>
            <div className={styles.tableWrap}>
              {rows.length ? <table className={styles.table}><thead><tr><th>Colaborador</th><th>Entrada</th><th>Pausa</th><th>Retorno</th><th>Saída</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{rows.map(({ employee, record }) => {
                const currentBalance = balance(record, employee.shift_type);
                const status = record?.exit_time ? "Concluído" : record?.entry_time ? "Em jornada" : "Sem registro";
                return <tr key={employee.id}><td><div className={styles.personCell}><span className={styles.personAvatar}>{initials(employee.name)}</span><span><b>{employee.name}</b><small>{employee.role}</small></span></div></td><td>{time(record?.entry_time ?? null)}</td><td>{time(record?.break_start ?? null)}</td><td>{time(record?.break_end ?? null)}</td><td>{time(record?.exit_time ?? null)}</td><td className={`${styles.balance} ${currentBalance.startsWith("+") ? styles.positive : currentBalance.startsWith("−") ? styles.negative : styles.neutral}`}>{currentBalance}</td><td><span className={`${styles.status} ${status === "Concluído" ? styles.done : status === "Em jornada" ? styles.working : styles.absent}`}>{status}</span></td></tr>;
              })}</tbody></table> : <div className={styles.empty}><strong>{query ? "Ninguém por aqui." : "O dia ainda está em silêncio."}</strong>{query ? "Tente buscar por outro nome." : "Os registros aparecem assim que a equipe começar a jornada."}</div>}
            </div>
          </section>
          </>}
        </div>
      </div>

{open && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="new-employee-title"><div className={styles.modalBand} /><div className={styles.modalBody}><span className={styles.modalIcon}><PeopleIcon /></span><h2 id="new-employee-title">Alguém novo na equipe.</h2><p className={styles.modalIntro}>Cadastre os dados essenciais para liberar o acesso ao totem.</p><div className={styles.field}><label htmlFor="employee-name">Nome completo</label><input id="employee-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Ana Beatriz Silva" autoFocus /></div><div className={styles.field}><label htmlFor="employee-role">Cargo</label><input id="employee-role" type="text" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Ex.: Recepcionista, Auxiliar administrativo" maxLength={100} /></div><div className={styles.field}><label htmlFor="employee-pin">PIN de acesso</label><input id="employee-pin" value={pin} maxLength={3} inputMode="numeric" onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="3 dígitos" /></div><fieldset className={styles.shiftField}><legend>Carga horária</legend><div className={styles.shiftOptions}><label className={shiftType === "full" ? styles.shiftSelected : ""}><input type="radio" name="shift" checked={shiftType === "full"} onChange={() => setShiftType("full")} /><b>8 horas</b><small>Período completo</small></label><label className={shiftType === "half" ? styles.shiftSelected : ""}><input type="radio" name="shift" checked={shiftType === "half"} onChange={() => setShiftType("half")} /><b>4 horas</b><small>Meio período</small></label></div></fieldset><div className={styles.modalActions}><button className={styles.cancelButton} onClick={() => setOpen(false)}>Agora não</button><button className={styles.saveButton} onClick={save}>Adicionar à equipe</button></div></div></div></div>}
    </main>
  );
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }
function NavItem({ active, icon, label, onClick }: { active?: boolean; icon: React.ReactNode; label: string; onClick?: () => void }) { const content = <>{icon}<span>{label}</span></>; const className = `${styles.navItem} ${active ? styles.active : ""}`; return onClick ? <button type="button" className={className} onClick={onClick} aria-current={active ? "page" : undefined}>{content}</button> : <span className={className}>{content}</span>; }
function Metric({ featured, label, value, meta, icon }: { featured?: boolean; label: string; value: string; meta: string; icon: React.ReactNode }) { return <article className={`${styles.metric} ${featured ? styles.metricFeature : ""}`}><div className={styles.metricTop}><span>{label}</span><span className={styles.metricIcon}>{icon}</span></div><strong className={styles.metricValue}>{value}</strong><small className={styles.metricMeta}>{meta}</small></article>; }
function Svg({ children }: { children: React.ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>; }
function GridIcon(){return <Svg><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></Svg>}
function ClockIcon(){return <Svg><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Svg>}
function PeopleIcon(){return <Svg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8m13 18v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75"/></Svg>}
function BellIcon(){return <Svg><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4"/></Svg>}
function PlusIcon(){return <Svg><path d="M12 5v14M5 12h14"/></Svg>}
function CheckCircleIcon(){return <Svg><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></Svg>}
function PulseIcon(){return <Svg><path d="M3 12h4l2-6 4 12 2-6h6"/></Svg>}
function TrendIcon(){return <Svg><path d="m3 17 6-6 4 4 8-8m-5 0h5v5"/></Svg>}
function SearchIcon(){return <Svg><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Svg>}
function MenuIcon(){return <Svg><path d="M4 7h16M4 12h16M4 17h16"/></Svg>}
