import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PontoSimples | Demonstração",
  description: "Protótipo de controle de ponto",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className="h-full"
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
