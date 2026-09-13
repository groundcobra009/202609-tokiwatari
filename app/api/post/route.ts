import { NextResponse } from "next/server";
import { generateFutureReply } from "@/lib/ai";
import { listPosts, putPost } from "@/lib/store";
import { kindOf, newId, type Post } from "@/lib/types";

// POST /api/post { author, authorName?, text, at? }
// at が未来なら kind=future で置き、未来の自分（AI推定）が返答する
export async function POST(req: Request) {
  let body: { author?: string; authorName?: string; text?: string; at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body が必要です" }, { status: 400 });
  }
  if (!body.author || !body.text?.trim()) {
    return NextResponse.json({ error: "author と text が必要です" }, { status: 400 });
  }
  const at = body.at ? new Date(body.at) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "at は ISO 8601 で指定してください" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const post: Post = {
    id: newId("p"),
    author: body.author,
    authorName: body.authorName || body.author,
    text: body.text.trim(),
    at: at.toISOString(),
    kind: kindOf(at.toISOString()),
    aiGenerated: false,
    createdAt: now,
  };
  await putPost(post);

  if (post.kind !== "future") {
    return NextResponse.json({ ok: true, post, aiReply: null, mode: null });
  }

  const history = (await listPosts(post.author)).filter((p) => !p.aiGenerated && !p.replyTo && p.id !== post.id);
  let generated: { text: string; mode: "live" | "mock" };
  try {
    generated = await generateFutureReply({ post, history });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: true, post, aiReply: null, mode: null, error: `AI返答に失敗: ${message}` }, { status: 502 });
  }
  const aiReply: Post = {
    id: newId("ai"),
    author: post.author,
    authorName: post.authorName,
    text: generated.text,
    at: post.at,            // 未来日付
    kind: "future",
    replyTo: post.id,
    aiGenerated: true,
    createdAt: new Date().toISOString(),
  };
  await putPost(aiReply);
  return NextResponse.json({ ok: true, post, aiReply, mode: generated.mode, historyCount: history.length });
}
