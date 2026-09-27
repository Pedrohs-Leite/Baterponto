-- Execute este arquivo no SQL Editor do Supabase antes de usar o protótipo.
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'Colaborador',
  photo_url text,
  pin text not null unique check (pin ~ '^[0-9]{1,3}$'),
  shift_type text not null default 'full' check (shift_type in ('full', 'half')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Para projetos que já executaram uma versão anterior deste script.
alter table public.employees add column if not exists shift_type text not null default 'full';
alter table public.employees drop constraint if exists employees_shift_type_check;
alter table public.employees add constraint employees_shift_type_check check (shift_type in ('full', 'half'));

create table if not exists public.time_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null default current_date,
  entry_time timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  exit_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

alter table public.employees enable row level security;
alter table public.time_records enable row level security;

-- Políticas temporárias para o protótipo. No produto, substitua por autenticação
-- e regras de acesso por perfil (administrador/funcionário).
create policy "demo employees read" on public.employees for select using (true);
create policy "demo employees insert" on public.employees for insert with check (true);
create policy "demo time records read" on public.time_records for select using (true);
create policy "demo time records insert" on public.time_records for insert with check (true);
create policy "demo time records update" on public.time_records for update using (true) with check (true);

insert into public.employees (name, role, pin) values
  ('Ana Beatriz', 'Atendimento', '123'),
  ('Marcelo Lima', 'Operações', '234'),
  ('Carla Souza', 'Financeiro', '345'),
  ('João Pedro', 'Estoque', '456')
on conflict (pin) do nothing;
