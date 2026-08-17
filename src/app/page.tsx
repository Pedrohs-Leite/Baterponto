"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Employee = { id: string; name: string; pin: string; shift_type: "full" | "half" };
type Tone = "tap" | "success" | "error";
const formatTime = () => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
const formatDate = () => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
const today = () => new Date().toISOString().slice(0, 10);

export default function Totem() {
  const [clock, setClock] = useState(formatTime());
  const [team, setTeam] = useState<Employee[]>([]);
  const [pin, setPin] = useState("");
  const [person, setPerson] = useState<Employee | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error" | "success">("info");
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const playTone = useCallback((tone: Tone) => {
    if (!soundEnabled || typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (tone === "tap" ? 0.09 : 0.35));
    const notes = tone === "success" ? [523, 659] : tone === "error" ? [220, 185] : [360];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = tone === "tap" ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      const start = context.currentTime + index * 0.11;
      oscillator.start(start);
      oscillator.stop(start + (tone === "tap" ? 0.08 : 0.18));
    });
    window.setTimeout(() => void context.close(), 600);
  }, [soundEnabled]);

  const reset = useCallback(() => { setPin(""); setPerson(null); setMessage(""); setMessageTone("info"); }, []);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("employees").select("id,name,pin,shift_type").eq("active", true);
      if (error) { setMessage("Conecte o banco de dados para ativar o totem."); setMessageTone("info"); }
      else setTeam(data ?? []);
    }
    void load();
    const id = window.setInterval(() => setClock(formatTime()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const typeDigit = useCallback((digit: string) => {
    if (pin.length >= 3 || person) return;
    playTone("tap");
    const nextPin = pin + digit;
    setPin(nextPin); setMessage("");
    if (nextPin.length === 3) {
      const employee = team.find((member) => member.pin === nextPin);
      if (employee) { setPerson(employee); playTone("success"); }
      else { setMessage("PIN não reconhecido. Confira e tente novamente."); setMessageTone("error"); playTone("error"); window.setTimeout(reset, 1500); }
    }
  }, [person, pin, playTone, reset, team]);

  const eraseDigit = useCallback(() => {
    if (!pin) return;
    playTone("tap"); setPin((current) => current.slice(0, -1)); setMessage("");
  }, [pin, playTone]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) typeDigit(event.key);
      if (event.key === "Backspace" || event.key === "Delete") eraseDigit();
      if (event.key === "Escape") reset();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [eraseDigit, reset, typeDigit]);

  async function punch() {
    if (!person || busy) return;
    setBusy(true); playTone("tap");
    const { data: record, error: findError } = await supabase.from("time_records").select("id,break_start,break_end,exit_time").eq("employee_id", person.id).eq("work_date", today()).maybeSingle();
    if (findError) { setMessage("Não foi possível registrar agora. Tente novamente."); setMessageTone("error"); setBusy(false); playTone("error"); return; }
    const stamp = new Date().toISOString();
    let action = "Entrada"; let error;
    if (!record) ({ error } = await supabase.from("time_records").insert({ employee_id: person.id, work_date: today(), entry_time: stamp }));
    else if (person.shift_type === "half" || record.break_end) { action = "Saída"; ({ error } = await supabase.from("time_records").update({ exit_time: stamp }).eq("id", record.id)); }
    else if (!record.break_start) { action = "Início do intervalo"; ({ error } = await supabase.from("time_records").update({ break_start: stamp }).eq("id", record.id)); }
    else { action = "Fim do intervalo"; ({ error } = await supabase.from("time_records").update({ break_end: stamp }).eq("id", record.id)); }
    setBusy(false);
    if (error) { setMessage("Não foi possível registrar agora. Tente novamente."); setMessageTone("error"); playTone("error"); return; }
    setMessage(`${action} registrada às ${formatTime()}.`); setMessageTone("success"); playTone("success"); window.setTimeout(reset, 2400);
  }

  const initials = person?.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return (
    <main className="totem-page">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <article className="totem-shell">
        <header className="brand-header">
          <div className="brand-glow" />
          <div className="logo-crop" aria-label="Convida 20 anos"><Image src="/logo-convida.png" alt="Convida — 20 anos" width={1920} height={1920} priority /></div>
          <span className="brand-divider" /><p>Controle de ponto</p>
        </header>
        <section className="time-panel" aria-label="Data e hora atual">
          <div><span className="live-dot" /><span>Totem online</span></div><strong>{clock}</strong><p>{formatDate()}</p>
        </section>
        <section className="interaction-panel">
          <button type="button" className={`sound-toggle ${soundEnabled ? "is-on" : ""}`} onClick={() => setSoundEnabled((enabled) => !enabled)} aria-label={soundEnabled ? "Desativar sons" : "Ativar sons"} title={soundEnabled ? "Desativar sons" : "Ativar sons"}>{soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}</button>
          <div className={`identity-icon ${person ? "has-person" : ""}`}>{person ? initials : <ClockIcon />}</div>
          {person ? <><p className="eyebrow">Identificação concluída</p><h1>Olá, {person.name.split(" ")[0]}!</h1><p className="supporting-copy">{person.shift_type === "half" ? "Jornada de meio período · 4 horas" : "Jornada completa · 8 horas"}</p></> : <><p className="eyebrow">Bem-vindo</p><h1>Registre seu ponto</h1><p className="supporting-copy">Digite seu PIN de acesso para continuar.</p></>}
          <div className="pin-display" aria-label={`${pin.length} de 3 dígitos informados`}>{[0, 1, 2].map((index) => <span key={index} className={pin[index] ? "filled" : ""} />)}</div>
          {message && <div className={`status-message ${messageTone}`} role="status">{messageTone === "success" ? <CheckIcon /> : messageTone === "error" ? <AlertIcon /> : <InfoIcon />}<span>{message}</span></div>}
          {person ? <div className="confirmation-actions"><button type="button" onClick={punch} disabled={busy} className="confirm-button">{busy ? <span className="spinner" /> : <CheckIcon />}{busy ? "Registrando..." : "Confirmar registro"}</button><button type="button" onClick={reset} className="secondary-button">Usar outro PIN</button></div> : <div className="keypad" aria-label="Teclado numérico">{["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => <button key={digit} type="button" onClick={() => typeDigit(digit)}>{digit}</button>)}<span aria-hidden="true" /><button type="button" onClick={() => typeDigit("0")}>0</button><button type="button" onClick={eraseDigit} className="erase-key" aria-label="Apagar dígito"><BackspaceIcon /></button></div>}
          <p className="keyboard-hint">Você também pode usar o teclado físico</p>
        </section>
      </article>
      <p className="privacy-note"><ShieldIcon /> Seus dados são processados com segurança</p>
    </main>
  );
}

function ClockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2M8 2h8M9 22h6"/></svg>; }
function SoundOnIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg>; }
function SoundOffIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 5 5 5m0-5-5 5"/></svg>; }
function BackspaceIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 6H9l-6 6 6 6h12V6Zm-8 4 4 4m0-4-4 4"/></svg>; }
function CheckIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>; }
function AlertIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Zm0 6v5m0 3h.01"/></svg>; }
function InfoIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>; }
function ShieldIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-4"/></svg>; }
