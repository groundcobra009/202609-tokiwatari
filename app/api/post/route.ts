import { withIdentity } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generateFutureReply } from "@/lib/ai";
import { listPosts, putPost } from "@/lib/store";
import { kindOf, newId, parseAccess, canRead, type Post } from "@/lib/types";

// POST /api/post { author, authorName?, text, at? }
// at が未来なら kind=future で置き、未来の自分（AI推定）が返答する
export const POST = withIdentity(async (req, user) => {
  let body: { visibility?: unknown; unlockAt?: unknown; author?: string; authorName?: string; text?: string; at?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body が必要です" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.text !== "string" || body.text.length > 2000 ||
    (body.at !== undefined && typeof body.at !== "string") ||
    (body.author !== undefined && typeof body.author !== "string") ||
    (body.authorName !== undefined && typeof body.authorName !== "string")) {
    return NextResponse.json({ error: "本文は2000文字以内の文字列、日時・投稿者は文字列で指定してください" }, { status: 400 });
  }
  if (user.enabled || !body.author) {
    body.author = user.id;
    body.authorName = user.name;
  }
  if (!body.author || !body.text?.trim()) {
    return NextResponse.json({ error: "author と text が必要です" }, { status: 400 });
  }
  let access: Pick<Post, "visibility" | "unlockAt">;
  try { access = parseAccess(body); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  const at = body.at ? new Date(body.at) : new Date();
  if (Number.isNaN(at.getTime())) {
    return NextResponse.json({ error: "at は ISO 8601 で指定してください" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const post: Post = {
    ...access,
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

  const history = (await listPosts(post.author)).filter((p) => !p.aiGenerated && !p.replyTo && p.id !== post.id && Date.parse(p.at) <= Date.parse(now) && canRead(p));
  let generated: { text: string; mode: "live" | "mock" };
  try {
    generated = await generateFutureReply({ post, history });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: true, post, aiReply: null, mode: null, error: `AI返答に失敗: ${message}` }, { status: 502 });
  }
  const aiReply: Post = {
    visibility: post.visibility,
    unlockAt: post.unlockAt,
    id: newId("ai"),
    author: post.author,
    authorName: post.authorName,
    text: generated.text,
    at: post.at,            // 未来日付
    kind: "future",
    replyTo: post.id,
    aiGenerated: true,
    aiMode: generated.mode,
    sourcePostIds: history.map((p) => p.id),
    createdAt: new Date().toISOString(),
  };
  await putPost(aiReply);
  return NextResponse.json({ ok: true, post, aiReply, mode: generated.mode, historyCount: history.length });
});
