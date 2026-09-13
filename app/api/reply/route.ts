import { withIdentity } from "@/lib/auth";
import { NextResponse } from "next/server";
import { generatePastReply } from "@/lib/ai";
import { getPost, listPosts, putPost } from "@/lib/store";
import { newId, parseAccess, canRead, type Post } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

// POST /api/reply { postId, text, author?, authorName? }
// 過去の投稿に返信 → 当時の本人（AI再現）が返答する
export const POST = withIdentity(async (req, user) => {
  let body: { visibility?: unknown; unlockAt?: unknown; postId?: string; text?: string; author?: string; authorName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body が必要です" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.text !== "string" || body.text.length > 2000 ||
    typeof body.postId !== "string" ||
    (body.author !== undefined && typeof body.author !== "string") ||
    (body.authorName !== undefined && typeof body.authorName !== "string")) {
    return NextResponse.json({ error: "本文は2000文字以内、postId・投稿者は文字列で指定してください" }, { status: 400 });
  }
  if (user.enabled || !body.author) {
    body.author = user.id;
    body.authorName = user.name;
  }
  if (!body.postId || !body.text?.trim()) {
    return NextResponse.json({ error: "postId と text が必要です" }, { status: 400 });
  }
  let access: Pick<Post, "visibility" | "unlockAt">;
  try { access = parseAccess(body); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  const target = await getPost(body.postId);
  if (!target) return NextResponse.json({ error: "投稿が見つかりません" }, { status: 404 });
  const viewer = user.enabled ? (user.authenticated ? user.id : "") : body.author;
  if (!canRead(target, viewer)) {
    return NextResponse.json({ error: "この投稿はまだ閲覧・返信できません" }, { status: 403 });
  }
  if (target.aiGenerated || target.replyTo) {
    return NextResponse.json({ error: "返信できるのは元の投稿だけです" }, { status: 400 });
  }

  // 当時までの公開履歴だけを渡す。疎な履歴でも未来へ探索を広げない。
  const t0 = Date.parse(target.at);
  const own = (await listPosts(target.author)).filter((p) =>
    !p.aiGenerated && !p.replyTo && Date.parse(p.at) <= t0 &&
    (p.id === target.id || canRead(p)),
  );
  const recent = own.filter((p) => t0 - Date.parse(p.at) <= 90 * DAY);
  const context = [...(recent.length > 1 ? recent : own)]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 10)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const rank = { public: 0, friends: 1, private: 2 };
  const targetVisibility = target.visibility ?? "public";
  if (rank[targetVisibility] > rank[access.visibility]) access.visibility = targetVisibility;
  if (target.unlockAt && (!access.unlockAt || Date.parse(target.unlockAt) > Date.parse(access.unlockAt))) {
    access.unlockAt = target.unlockAt;
  }
  const now = new Date().toISOString();
  const human: Post = {
    ...access,
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
    ...access,
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
});
