import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Convida | Controle de ponto",
  description: "Totem digital de controle de ponto da Convida",
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
