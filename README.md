# ManagSub

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
2. Aplica las migraciones de [`supabase/migrations/`](supabase/migrations/) en orden (SQL Editor > New query > pegar > **Run**):
   - `20261117023242_create_demo_items.sql`: tabla de diagnóstico (ya aplicada).
   - `20261122120000_phase2_personal_subscriptions.sql`: perfiles, categorías, suscripciones personales, precios y pagos.
3. En **Authentication > URL Configuration** añade a *Redirect URLs* cada origen desde el que abras la app, terminado en `/**`:
   - `http://localhost:3000/**`
   - en Codespaces, la URL pública del puerto 3000 (por ejemplo `https://<codespace>-3000.app.github.dev/**`).
4. Opcional, para que los enlaces de los correos funcionen en cualquier navegador: en **Authentication > Email Templates** cambia el enlace de *Confirm signup* por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` y el de *Reset password* por
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&siguiente=/restablecer`.
   Con las plantillas por defecto también funcionan, pero solo en el mismo navegador en que se pidieron.

El correo de Supabase por defecto solo envía a las direcciones del equipo del proyecto y con un límite bajo por hora. Para registrar a otras personas hace falta un SMTP propio.

## Diseño

El diseño actual (v2) es más ligero que el del prototipo de la fase 1. El v1 está guardado en la etiqueta git `diseno-v1`:

```bash
git show diseno-v1:src/app/globals.css     # ver un archivo del v1
git switch --detach diseno-v1              # abrir el v1 completo (vuelve con: git switch main)
```

El prototipo con datos ficticios sigue en `/prototipo` (solo en desarrollo).

## Scripts

| Comando             | Qué hace                                 |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Servidor de desarrollo                   |
| `npm run build`     | Build de producción                      |
| `npm run start`     | Sirve el build de producción             |
| `npm run lint`      | ESLint                                   |
| `npm run typecheck` | Genera los tipos de rutas y ejecuta `tsc` |
