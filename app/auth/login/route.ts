import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth";
export async function GET(req: NextRequest) {
  try {
    const config = await authConfig();
    if (!config) return NextResponse.redirect(new URL("/", req.url));
    const { getSignInUrl } = await import("@workos-inc/authkit-nextjs");
    const url = await getSignInUrl({ redirectUri: config.redirectUri, returnTo: "/" });
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "ログインを開始できません。認証設定を確認してください" }, { status: 503 });
  }
}
