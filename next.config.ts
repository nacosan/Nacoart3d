import type { NextConfig } from "next";

/**
 * En GitHub Codespaces la app se abre desde https://<codespace>-<puerto>.app.github.dev,
 * pero el servidor recibe "localhost". Next.js rechaza entonces las Server Actions
 * (protección CSRF) porque el origen no coincide. Se permite SOLO el host exacto de
 * este Codespace, calculado con las variables que define GitHub; fuera de Codespaces
 * la lista queda vacía.
 */
const codespaceName = process.env.CODESPACE_NAME;
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const port = process.env.PORT ?? "3000";
const inCodespace = Boolean(codespaceName && forwardingDomain);
const codespaceHosts = inCodespace ? [`${codespaceName}-${port}.${forwardingDomain}`] : [];
// El proxy de Codespaces reescribe la cabecera Origin a "localhost:<puerto>" mientras
// x-forwarded-host lleva el host público, así que ese origen también hay que permitirlo.
// Solo dentro de un Codespace: allí nada más puede servir páginas en ese origen.
const actionOrigins = inCodespace ? [...codespaceHosts, `localhost:${port}`] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: codespaceHosts,
  experimental: {
    serverActions: {
      allowedOrigins: actionOrigins,
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
