import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth";
export async function GET(req: NextRequest) {
  const config = await authConfig();
  if (!config) return NextResponse.redirect(new URL("/", req.url));
  const { handleAuth } = await import("@workos-inc/authkit-nextjs");
  return handleAuth({ returnPathname: "/", onError: async () => NextResponse.json({ error: "ログインに失敗しました。もう一度お試しください" }, { status: 400 }) })(req);
}
