import type { Metadata, Viewport } from "next";
import "./style.css";

export const metadata: Metadata = {
  title: "Junta · Despesas em grupo",
  description: "Divida despesas por produto e acompanhe os saldos do grupo.",
  appleWebApp: { capable: true, title: "Junta" },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#f8f8f3" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
