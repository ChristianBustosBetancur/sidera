import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TrajectoryProvider } from "../lib/trajectory";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan curricular | Sidera",
  description: "Plan oficial de Ciencias de la Computación, Acuerdo 0018 de 2024",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body><TrajectoryProvider>{children}</TrajectoryProvider></body>
    </html>
  );
}
