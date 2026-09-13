import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "./store";

export interface Identity {
  id: string;
  name: string;
  enabled: boolean;
  authenticated: boolean;
}
const guest = { id: "guest", name: "ゲスト", authenticated: false };
const KEYS = ["WORKOS_API_KEY", "WORKOS_CLIENT_ID", "WORKOS_COOKIE_PASSWORD", "NEXT_PUBLIC_WORKOS_REDIRECT_URI"] as const;

export async function authConfig() {
  const env = await getEnv();
  const values = KEYS.map((key) => String(env[key] ?? process.env[key] ?? ""));
  if (values.some((value) => !value)) return null;
  if (values[2].length < 32) throw new Error("認証設定を確認してください");
  // AuthKit はロード時に process.env を読む。Workers bindings を先に渡す。
  KEYS.forEach((key, i) => { process.env[key] = values[i]; });
  return { redirectUri: values[3] };
}

export async function currentUser(req: NextRequest): Promise<{ user: Identity; headers: Headers }> {
  const config = await authConfig();
  if (!config) return { user: { ...guest, enabled: false }, headers: new Headers() };
  // Cookie が無い匿名アクセスでは認証リダイレクトやPKCE Cookieを生成しない。
  if (!req.cookies.has("wos-session")) return { user: { ...guest, enabled: true }, headers: new Headers() };
  const sdk = await import("@workos-inc/authkit-nextjs");
  const result = await sdk.authkit(req, { redirectUri: config.redirectUri });
  const { responseHeaders } = sdk.partitionAuthkitHeaders(req, result.headers);
  const user = result.session.user;
  return {
    user: user ? { id: user.id, name: "けいたろう", enabled: true, authenticated: true } : { ...guest, enabled: true },
    headers: responseHeaders,
  };
}

/** APIごとに署名済みセッションを検証し、安全なレスポンスヘッダーだけ反映する。 */
export function withIdentity(handler: (req: NextRequest, user: Identity) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    let context: Awaited<ReturnType<typeof currentUser>>;
    try { context = await currentUser(req); }
    catch { return NextResponse.json({ error: "認証を確認できません。再度ログインしてください" }, { status: 503 }); }
    const response = await handler(req, context.user);
    context.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") response.headers.set(key, value);
    });
    for (const cookie of context.headers.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  };
}
