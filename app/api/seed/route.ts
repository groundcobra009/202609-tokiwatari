import { NextResponse } from "next/server";
import { putPosts } from "@/lib/store";
import { kindOf, newId, parseAccess, type Post } from "@/lib/types";

// POST /api/seed { posts: Partial<Post>[], reset?: boolean }
export async function POST(req: Request) {
  // 初期投入はローカル開発専用。本番のデモを第三者に上書きさせない。
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(req.url).hostname)) {
    return NextResponse.json({ error: "公開環境ではデモデータの投入・初期化はできません" }, { status: 403 });
  }
  let body: { posts?: Partial<Post>[]; reset?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body が必要です" }, { status: 400 });
  }
  if (!body || !Array.isArray(body.posts) || body.posts.length === 0) {
    return NextResponse.json({ error: "posts（配列）が必要です" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const posts: Post[] = [];
  for (const raw of body.posts) {
    if (!raw || typeof raw.author !== "string" || !raw.author || typeof raw.text !== "string" || !raw.text || typeof raw.at !== "string" || !raw.at || Number.isNaN(new Date(raw.at).getTime())) {
      return NextResponse.json({ error: "author/text/at は有効な文字列で指定してください" }, { status: 400 });
    }
    let access: Pick<Post, "visibility" | "unlockAt">;
    try { access = parseAccess(raw); }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
    posts.push({
      ...access,
      id: raw.id ?? newId("seed"),
      author: raw.author,
      authorName: raw.authorName ?? raw.author,
      text: raw.text,
      at: new Date(raw.at).toISOString(),
      kind: raw.kind ?? kindOf(raw.at),
      replyTo: raw.replyTo,
      aiGenerated: raw.aiGenerated ?? false,
      createdAt: raw.createdAt ?? now,
    });
  }
  const count = await putPosts(posts, body.reset === true);
  return NextResponse.json({ ok: true, count, reset: body.reset === true });
}
