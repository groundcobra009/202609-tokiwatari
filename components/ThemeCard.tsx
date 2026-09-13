"use client";

import { useEffect, useState } from "react";

export default function ThemeCard({ onSelect }: { onSelect: (theme: string) => void }) {
  const [theme, setTheme] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/theme", { cache: "no-store", signal: controller.signal })
      .then(async (res) => { if (!res.ok) throw new Error(); return await res.json() as { theme: string }; })
      .then((data) => setTheme(data.theme))
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  return (
    <section className="tw-theme" aria-label="今日のテーマ">
      <h3>今日のテーマ</h3>
      <p>{theme || (error ? "テーマを取得できませんでした。自由に書いてみてください。" : "テーマを読み込み中…")}</p>
      <button type="button" disabled={!theme} onClick={() => onSelect(theme)}>このテーマで書く</button>
    </section>
  );
}
