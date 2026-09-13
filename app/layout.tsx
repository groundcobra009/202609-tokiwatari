import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "タイムトーク — 思考が時を超えるSNS",
  icons: { icon: "/timetalk-mark.svg", apple: "/timetalk-mark.svg" },
  description: "過去の自分が返事をし、未来の自分から手紙が届くタイムライン",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
