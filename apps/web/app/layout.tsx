import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TrajectoryProvider } from "../lib/trajectory";
import { AppShell } from "./app-shell";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Plan curricular | Sidera",
  description: "Plan oficial de Ciencias de la Computación, Acuerdo 0018 de 2024",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {/* El shell envuelve a las tres vistas desde el layout raíz: la
            navegación vive en un solo sitio y no se duplica por página. */}
        <TrajectoryProvider>
          <AppShell>{children}</AppShell>
        </TrajectoryProvider>
        {process.env.VERCEL_ENV !== "production" ? (
          <aside className={styles.previewBadge}>
            <span aria-hidden="true">🚧</span> Sidera Preview · En desarrollo
          </aside>
        ) : null}
      </body>
    </html>
  );
}
