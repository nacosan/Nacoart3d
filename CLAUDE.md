@AGENTS.md

# ManagSub

## Stack
- Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto.
- Tailwind CSS 4 (sin estilos inline). ESLint 9 (flat config).
- Supabase (PostgreSQL + Auth con cookies) mediante `@supabase/ssr`.
- npm como único gestor de paquetes.

## Estructura
- `src/app/`: rutas (App Router).
- `src/components/`: componentes, por niveles (Atomic Design):
  - `atoms/`: piezas mínimas y genéricas (botón, icono, etiqueta, importe, avatar, logotipo).
  - `molecules/`: combinaciones pequeñas y genéricas (campo con etiqueta, ventana, tarjeta, botones de acción).
  - `organisms/<apartado>/`: bloques con sentido propio, agrupados por apartado (`subscriptions/`, `groups/`, `app/`, `charts/`…).
  - `templates/`: estructura de las pantallas (`AppShell`). Las páginas son los `page.tsx` de `src/app/`.
  - `prototype/`: prototipo con datos ficticios (solo en desarrollo).
  - Un componente nuevo va al nivel más bajo que le corresponda; si solo lo usa un apartado, a su organismo.
- `src/utils/supabase/`: `env.ts` (variables), `client.ts` (navegador), `server.ts` (servidor), `proxy.ts` (`updateSession`).
- `src/proxy.ts`: entrada de Proxy de Next 16 (no crear `middleware.ts`).
- `supabase/migrations/`: migraciones SQL.

## Comandos
- `npm run dev`, `npm run build`, `npm run start`
- `npm run lint`, `npm run typecheck`

## Convenciones
- Server Components por defecto; `"use client"` solo si hace falta.
- En el servidor usa `createClient()` de `@/utils/supabase/server` y autoriza con `supabase.auth.getClaims()`, nunca solo con `getSession()`.
- Si el proxy devuelve otra respuesta o redirección, copia las cookies con `withSupabaseCookies`.
- Solo la clave publicable de Supabase. Nunca `service_role` ni claves secretas en el código.
- RLS activado en todas las tablas; nunca desactivarlo para resolver errores.
- No mostrar errores internos en la UI; registrarlos en el servidor.
- Antes de terminar un cambio: `npm run lint`, `npm run typecheck` y `npm run build`.

## Requiere aprobación previa del usuario
- Cambios de esquema o datos en Supabase (migraciones, políticas, SQL de escritura).
- Operaciones destructivas (borrar archivos, `git push --force`, reescribir historial).
- Nuevas dependencias.
- Commits y push.
