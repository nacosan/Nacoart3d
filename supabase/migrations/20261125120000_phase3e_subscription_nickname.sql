-- Fase 3e: nombre personalizado de una suscripción (por ejemplo, "Spotify de casa").
--
-- name sigue siendo lo que es de verdad (servicio y plan) y sirve para el
-- logotipo; nickname es opcional y, si existe, la app lo muestra como título
-- con name debajo en pequeño. Lo edita quien es propietario o líder.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subscriptions' and column_name = 'nickname'
  ) then
    raise exception 'La fase 3e ya está aplicada.';
  end if;
end
$$;

alter table public.subscriptions
  add column nickname text check (nickname is null or char_length(btrim(nickname)) between 1 and 60);

grant update (nickname) on table public.subscriptions to authenticated;
