import type { NextResponse } from "next/server";
import { fail } from "./api";
import {
  AuthConfigError,
  SESSION_COOKIE,
  parseCookies,
  verifySession,
} from "./session";

/**
 * P1b 统一登录闸门：所有需要登录态的路由（invite / gifts）都先过这里。
 *
 * - 无 cookie / 无效 / 过期 / 被篡改 ⇒ `{ ok:false, response: 401 unauthenticated }`
 * - AUTH_SECRET 未配置 ⇒ `{ ok:false, response: 503 auth_not_configured }`（不是 401、不是 500）
 * - 通过 ⇒ `{ ok:true, uid, name? }`（uid = Discord user id）
 */
export type SessionResult =
  | { ok: true; uid: string; name?: string }
  | { ok: false; response: NextResponse };

export function requireSession(req: Request): SessionResult {
  const cookies = parseCookies(req.headers.get("cookie"));
  let session: ReturnType<typeof verifySession>;
  try {
    session = verifySession(cookies[SESSION_COOKIE] ?? null);
  } catch (err) {
    if (err instanceof AuthConfigError) {
      return { ok: false, response: fail(503, "auth_not_configured", err.message) };
    }
    throw err;
  }
  if (!session) {
    return { ok: false, response: fail(401, "unauthenticated", "未登录或会话已过期") };
  }
  return { ok: true, uid: session.uid, name: session.name };
}
