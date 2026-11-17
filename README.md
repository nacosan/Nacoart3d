# NacoArt3D

Aplicación web con Next.js (App Router) y Supabase.

## Requisitos

- Node.js 20.9 o superior (probado con Node 24).
- npm.
- Un proyecto de Supabase.

## Arranque

```powershell
npm install
Copy-Item .env.example .env.local   # y rellena los valores
npm run dev
```

Abre <http://localhost:3000>.

## Configurar Supabase

1. En Supabase Dashboard > **Project Settings > API Keys** copia la **Project URL** y la **Publishable key** (`sb_publishable_...`) en `.env.local`. No uses la clave secreta ni `service_role`.
2. Abre **SQL Editor > New query**, pega el contenido de [`supabase/migrations/20261117023242_create_demo_items.sql`](supabase/migrations/20261117023242_create_demo_items.sql) y pulsa **Run**.
3. Recarga la página inicial. La sección de diagnóstico debe mostrar los dos registros de ejemplo.

La tabla `demo_items` tiene lectura pública solo porque son datos de demostración. Las tablas con datos privados necesitarán políticas RLS restringidas.

## Scripts

| Comando             | Qué hace                                 |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                   |
| `npm run build`     | Build de producción                      |
| `npm run start`     | Sirve el build de producción             |
| `npm run lint`      | ESLint                                   |
| `npm run typecheck` | Genera los tipos de rutas y ejecuta `tsc` |
