import { NextResponse } from "next/server";
import { generatePastReply } from "@/lib/ai";
import { getPost, listPosts, putPost } from "@/lib/store";
import { newId, type Post } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

// POST /api/reply { postId, text, author?, authorName? }
// 過去の投稿に返信 → 当時の本人（AI再現）が返答する
export async function POST(req: Request) {
  let body: { postId?: string; text?: string; author?: string; authorName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body が必要です" }, { status: 400 });
  }
  if (!body.postId || !body.text?.trim()) {
    return NextResponse.json({ error: "postId と text が必要です" }, { status: 400 });
  }
  const target = await getPost(body.postId);
  if (!target) return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  if (target.aiGenerated || target.replyTo) {
    return NextResponse.json({ error: "返信できるのは元の投稿だけです" }, { status: 400 });
  }

  // 文脈: 同一 author の ±90日の投稿。無ければ時間座標が近い順に10件
  const own = (await listPosts(target.author)).filter((p) => !p.aiGenerated && !p.replyTo);
  const t0 = new Date(target.at).getTime();
  let context = own.filter((p) => Math.abs(new Date(p.at).getTime() - t0) <= 90 * DAY);
  if (context.length <= 1) {
    context = [...own]
      .sort((a, b) => Math.abs(new Date(a.at).getTime() - t0) - Math.abs(new Date(b.at).getTime() - t0))
      .slice(0, 10)
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  const now = new Date().toISOString();
  const human: Post = {
    id: newId("r"),
    author: body.author || "you",
    authorName: body.authorName || body.author || "あなた",
    text: body.text.trim(),
    at: target.at,          // スレッドとして元投稿の時間座標に置く
    kind: "now",            // 書いたのは今
    replyTo: target.id,
    aiGenerated: false,
    createdAt: now,
  };

  let generated: { text: string; mode: "live" | "mock" };
  try {
    generated = await generatePastReply({ target, context, userText: human.text });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `AI返答に失敗: ${message}` }, { status: 502 });
  }

  const aiReply: Post = {
    id: newId("ai"),
    author: target.author,
    authorName: target.authorName,
    text: generated.text,
    at: target.at,          // 元投稿と同じ時間座標
    kind: target.kind,
    replyTo: target.id,
    aiGenerated: true,
    createdAt: new Date().toISOString(),
  };
  await putPost(human);
  await putPost(aiReply);
  return NextResponse.json({ ok: true, mode: generated.mode, contextCount: context.length, reply: human, aiReply });
}
