export type PostKind = "past" | "now" | "future";

export type Visibility = "public" | "friends" | "private";

export interface Post {
  id: string;
  author: string;       // 例: keitaro
  authorName: string;   // 表示名。例: けいたろう
  text: string;
  at: string;           // ISO 8601。思考の時間座標
  kind: PostKind;
  replyTo?: string;     // スレッド親の id
  aiGenerated: boolean; // AI再現・AI推定の返答なら true
  aiMode?: AiMode;
  sourcePostIds?: string[]; // 生成時にAIへ渡した記録。引用の保証ではない
  visibility: Visibility;
  unlockAt?: string;
  locked?: boolean; // 応答時のみ。保存しない
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

/** 未指定の旧データは public。無効な公開設定は保存前に拒否する。 */
export function parseAccess(input: { visibility?: unknown; unlockAt?: unknown }): Pick<Post, "visibility" | "unlockAt"> {
  const visibility = input.visibility ?? "public";
  if (visibility !== "public" && visibility !== "friends" && visibility !== "private") {
    throw new Error("visibility は public / friends / private で指定してください");
  }
  if (input.unlockAt === undefined) return { visibility };
  if (typeof input.unlockAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(input.unlockAt) || !Number.isFinite(Date.parse(input.unlockAt))) {
    throw new Error("unlockAt は ISO 8601 で指定してください");
  }
  return { visibility, unlockAt: new Date(input.unlockAt).toISOString() };
}

export function canRead(post: Post, viewer = "", now = Date.now()): boolean {
  if (viewer && viewer === post.author) return true;
  if (post.visibility === "private") return false;
  if (post.visibility === "friends" && !viewer) return false;
  return !post.unlockAt || Date.parse(post.unlockAt) <= now;
}

export function forViewer(post: Post, viewer = "", now = Date.now()): Post {
  const { locked: _locked, ...stored } = post;
  return canRead(post, viewer, now)
    ? { ...stored, visibility: post.visibility ?? "public" }
    : { ...stored, visibility: post.visibility ?? "public", text: "", sourcePostIds: undefined, locked: true };
}
