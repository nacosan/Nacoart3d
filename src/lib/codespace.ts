/**
 * Origen público cuando la app corre en GitHub Codespaces
 * (https://<codespace>-<puerto>.app.github.dev). Allí el servidor recibe
 * "localhost" en las cabeceras, así que no sirve para construir enlaces.
 * Fuera de Codespaces devuelve null.
 */
export function codespaceOrigin(): string | null {
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !domain) return null;
  return `https://${name}-${process.env.PORT ?? "3000"}.${domain}`;
}
