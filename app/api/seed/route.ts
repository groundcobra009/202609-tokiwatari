import { NextResponse } from "next/server";
import { putPosts } from "@/lib/store";
import { kindOf, newId, type Post } from "@/lib/types";

// POST /api/seed { posts: Partial<Post>[], reset?: boolean }
export async function POST(req: Request) {
  let body: { posts?: Partial<Post>[]; reset?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body が必要です" }, { status: 400 });
  }
  if (!Array.isArray(body.posts) || body.posts.length === 0) {
    return NextResponse.json({ error: "posts（配列）が必要です" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const posts: Post[] = [];
  for (const raw of body.posts) {
    if (!raw.author || !raw.text || !raw.at || Number.isNaN(new Date(raw.at).getTime())) {
      return NextResponse.json({ error: `author/text/at が不正: ${JSON.stringify(raw).slice(0, 80)}` }, { status: 400 });
    }
    posts.push({
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
