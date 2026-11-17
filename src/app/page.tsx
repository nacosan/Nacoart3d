import { DemoItemsDiagnostic } from "@/components/DemoItemsDiagnostic";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-16 sm:px-8 sm:py-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          NacoArt3D
        </h1>
        <p className="text-lg text-foreground/70">Sitio en preparación.</p>
      </header>

      <DemoItemsDiagnostic />
    </main>
  );
}
