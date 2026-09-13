import { withIdentity } from "@/lib/auth";
import { NextResponse } from "next/server";
import { forViewer } from "@/lib/types";
import { listPosts } from "@/lib/store";

// GET /api/timeline?from=ISO&to=ISO&author=keitaro
export const GET = withIdentity(async (req, user) => {
  const url = new URL(req.url);
  const viewer = user.enabled ? (user.authenticated ? user.id : "") : url.searchParams.get("viewer") || "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const author = url.searchParams.get("author") || undefined;
  const fromT = from ? new Date(from).getTime() : -Infinity;
  const toT = to ? new Date(to).getTime() : Infinity;
  if (Number.isNaN(fromT) || Number.isNaN(toT)) {
    return NextResponse.json({ error: "from/to は ISO 8601 で指定してください" }, { status: 400 });
  }
  const posts = (await listPosts(author)).filter((p) => {
    const t = new Date(p.at).getTime();
    return t >= fromT && t <= toT;
  }).map((p) => forViewer(p, viewer));
  return NextResponse.json({ now: new Date().toISOString(), count: posts.length, posts }, { headers: { "Cache-Control": "private, no-store" } });
});
