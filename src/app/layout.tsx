import type { Metadata } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeFrom } from "@/lib/theme";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ManagSub",
  description: "ManagSub: gestiona tus suscripciones personales y compartidas",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El tema se pinta desde el servidor (cookie) para que no parpadee al cargar.
  const theme = themeFrom((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="es" data-theme={theme} className={`${manrope.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
