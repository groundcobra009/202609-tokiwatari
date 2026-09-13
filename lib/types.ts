export type PostKind = "past" | "now" | "future";

export interface Post {
  id: string;
  author: string;       // 例: keitaro
  authorName: string;   // 表示名。例: けいたろう
  text: string;
  at: string;           // ISO 8601。思考の時間座標
  kind: PostKind;
  replyTo?: string;     // スレッド親の id
  aiGenerated: boolean; // AI再現・AI推定の返答なら true
  createdAt: string;    // ISO 8601。実際に書かれた時刻
}

export type AiMode = "live" | "mock";

export function kindOf(at: string, now: Date = new Date()): PostKind {
  const t = new Date(at).getTime();
  if (t > now.getTime()) return "future";
  // 「今」は前後1日
  if (Math.abs(now.getTime() - t) < 24 * 60 * 60 * 1000) return "now";
  return "past";
}

export function newId(prefix = "p"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
