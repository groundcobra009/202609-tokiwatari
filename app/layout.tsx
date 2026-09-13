import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "時渡り — 思考が時を超えるSNS",
  description: "過去の自分が返事をし、未来の自分から手紙が届くタイムライン",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
