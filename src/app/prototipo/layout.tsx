import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Prototipo · NacoArt3D",
  robots: { index: false, follow: false },
};

/**
 * Prototipo con datos ficticios: solo existe en desarrollo, salvo que se
 * active a propósito con ENABLE_PROTOTYPE=true.
 */
export default function PrototypeLayout({ children }: LayoutProps<"/prototipo">) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_PROTOTYPE !== "true") {
    notFound();
  }
  return children;
}
