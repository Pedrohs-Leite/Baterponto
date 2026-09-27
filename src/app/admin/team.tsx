"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./admin.module.css";

type Member = { id: string; name: string; role: string; shift_type: "full" | "half" };

export default function Team({ employees, onAdd }: { employees: Member[]; onAdd: () => void }) {
  const [search, setSearch] = useState("");
  const [photos, setPhotos] = useState<{ [id: string]: string }>({});
  const [photoState, setPhotoState] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadPhotos() {
      const { data, error } = await supabase.from("employees").select("id,photo_url").eq("active", true);
      if (cancelled) return;
      if (error) {
        setPhotoState(error.code === "42703" || error.code === "PGRST204"
          ? "As fotos ainda não foram configuradas. Por enquanto, exibimos as iniciais."
          : "Não foi possível carregar as fotos. Os nomes e cargos continuam disponíveis.");
        return;
      }
      setPhotos(Object.fromEntries((data ?? []).map((row) => [row.id, row.photo_url ?? ""])));
    }
    void loadPhotos();
    return () => { cancelled = true; };
  }, [employees]);

  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const visible = employees.filter((member) => normalize(`${member.name} ${member.role}`).includes(normalize(search.trim())));

  return <section aria-labelledby="team-title">
    <header className={styles.hero}>
      <div><p className={styles.kicker}>Nossa equipe</p><h1 id="team-title">Pessoas que fazem acontecer.</h1><p className={styles.heroSub}>Conheça os colaboradores e suas funções na Convida.</p></div>
      <button type="button" className={styles.addButton} onClick={onAdd} aria-label="Novo funcionário">+ <span>Novo funcionário</span></button>
    </header>
    <div className={styles.teamToolbar}>
      <p><strong>{employees.length}</strong> {employees.length === 1 ? "colaborador cadastrado" : "colaboradores cadastrados"}</p>
      <label className={styles.search}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou cargo" aria-label="Buscar por nome ou cargo" /></label>
    </div>
    {photoState && <p className={styles.teamHint} role="status">{photoState}</p>}
    {visible.length ? <div className={styles.teamGrid}>{visible.map((member) => <article className={styles.teamCard} key={member.id}>
      <div className={styles.teamCover}><span>CONVIDA</span></div>
      <Portrait name={member.name} src={photos[member.id]} />
      <div className={styles.teamDetails}><h2>{member.name}</h2><p>{member.role || "Colaborador"}</p><span className={styles.teamShift}>{member.shift_type === "half" ? "4 horas · Meio período" : "8 horas · Período completo"}</span></div>
    </article>)}</div> : <div className={styles.empty}><strong>{search ? "Nenhum colaborador encontrado." : "Sua equipe começa aqui."}</strong>{search ? "Tente outro nome ou cargo." : "Use Novo funcionário para cadastrar o primeiro colaborador."}</div>}
  </section>;
}

function Portrait({ name, src }: { name: string; src?: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  const usable = src && /^https:\/\//i.test(src) && failedSource !== src;
  return <div className={styles.teamPortrait}>{usable
    ? <Image src={src} alt={`Foto de ${name}`} width={96} height={96} unoptimized onError={() => setFailedSource(src)} />
    : <span aria-label={`${name}, sem foto`}>{name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>}</div>;
}
