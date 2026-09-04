import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bitrix24 Integration API",
  description: "API-прослойка Bitrix24 <-> REGNUM <-> Moloni <-> Автосервис",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>{children}</body>
    </html>
  );
}
