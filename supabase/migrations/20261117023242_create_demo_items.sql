-- demo_items: tabla pública SOLO para comprobar la conexión con Supabase.
-- La política de lectura pública es válida únicamente para estos datos de
-- demostración. NO la copies para tablas con datos privados o de usuarios.

-- 1. Seguridad: si la tabla ya existe, no se toca nada.
do $$
begin
  if to_regclass('public.demo_items') is not null then
    raise exception 'public.demo_items ya existe. Revisa su estructura antes de modificarla.';
  end if;
end
$$;

-- 2. Tabla.
create table public.demo_items (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.demo_items is
  'Datos de demostración de lectura pública. No usar para datos privados.';

-- 3. Row Level Security activado (nunca se desactiva).
alter table public.demo_items enable row level security;

-- 4. Privilegios: se retira todo y se concede solo lectura.
revoke all on table public.demo_items from anon, authenticated;
grant select on table public.demo_items to anon, authenticated;

-- 5. Política explícita de lectura pública. No hay políticas de
--    INSERT, UPDATE ni DELETE, así que el cliente no puede escribir.
create policy "demo_items_public_read"
  on public.demo_items
  for select
  to anon, authenticated
  using (true);

-- 6. Datos de ejemplo.
insert into public.demo_items (name) values
  ('Elemento de demostración 1'),
  ('Elemento de demostración 2');
