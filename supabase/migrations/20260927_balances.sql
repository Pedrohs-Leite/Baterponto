-- Atualização incremental: execute este arquivo no SQL Editor do projeto.
-- Mantém o modelo de acesso do protótipo, que ainda não possui login de administrador.
begin;
alter table public.time_records add column if not exists expected_minutes integer
  check (expected_minutes in (240,480));
update public.time_records r set expected_minutes = case when e.shift_type = 'half' then 240 else 480 end
from public.employees e where e.id = r.employee_id and r.expected_minutes is null;

create or replace function public.capture_workday_target() returns trigger
language plpgsql set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    select case when shift_type = 'half' then 240 else 480 end into new.expected_minutes
      from public.employees where id = new.employee_id;
  else
    new.expected_minutes := old.expected_minutes;
  end if;
  return new;
end;
$$;
drop trigger if exists capture_workday_target on public.time_records;
create trigger capture_workday_target before insert or update on public.time_records
for each row execute function public.capture_workday_target();

create table if not exists public.balance_adjustments (
  id uuid primary key,
  employee_id uuid not null references public.employees(id),
  minutes integer not null check (minutes <> 0 and abs(minutes) <= 60000),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);
alter table public.balance_adjustments enable row level security;
drop policy if exists "demo adjustments read" on public.balance_adjustments;
drop policy if exists "demo adjustments insert" on public.balance_adjustments;
create policy "demo adjustments read" on public.balance_adjustments for select to anon, authenticated using (true);
create policy "demo adjustments insert" on public.balance_adjustments for insert to anon, authenticated with check (true);
grant select, insert on public.balance_adjustments to anon, authenticated;
-- Ajustes são novos lançamentos; a interface não altera nem apaga o histórico.
commit;
