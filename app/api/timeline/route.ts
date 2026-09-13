import { NextResponse } from "next/server";
import { listPosts } from "@/lib/store";

// GET /api/timeline?from=ISO&to=ISO&author=keitaro
export async function GET(req: Request) {
  const url = new URL(req.url);
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
  });
  return NextResponse.json({ now: new Date().toISOString(), count: posts.length, posts });
}
