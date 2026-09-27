-- Execute apenas esta migração no SQL Editor para habilitar fotos.
-- Preencha photo_url com o endereço HTTPS da foto do colaborador.
alter table public.employees
  add column if not exists photo_url text;
