import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/lib/auth";
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== new URL(req.url).origin) {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 403 });
  }
  const config = await authConfig();
  if (!config) return NextResponse.redirect(new URL("/", req.url), 303);
  const { signOut } = await import("@workos-inc/authkit-nextjs");
  return signOut({ returnTo: new URL("/", config.redirectUri).toString() });
}
