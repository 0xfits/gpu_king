import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { fail, internal } from "../../../../lib/server/api";
import { buildAuthorizeUrl, resolveOrigin, sanitizeInvite } from "../../../../lib/server/oauth";
import {
  AuthConfigError,
  OAUTH_COOKIE,
  OAUTH_TTL_SEC,
  sessionCookieOptions,
  signState,
} from "../../../../lib/server/session";

/** 路由级强制动态：每请求读环境/头，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/login[?invite=<slug>]
 *
 * 缺 DISCORD_CLIENT_SECRET（或 clientId）⇒ **503 auth_not_configured**（不是 500）。
 * 否则：16 字节随机 state，连同 invite slug 一起 HMAC 签名写进临时 cookie `gk_oauth`
 * （HttpOnly / Max-Age 600 / SameSite=Lax），再 302 到 Discord 授权页。
 *
 * state 只存在 HttpOnly cookie 里、不放进 query 串（避免 Referer 泄漏），
 * callback 时用 cookie 里的签名 state 与 query 里的 state 常量时间比对。
 */
export async function GET(req: Request) {
  try {
    const clientId =
      process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
    if (!clientId.trim() || !clientSecret.trim()) {
      return fail(503, "auth_not_configured", "缺少 DISCORD_CLIENT_SECRET（或 DISCORD_CLIENT_ID）");
    }

    const origin = resolveOrigin(req);
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/callback`;
    const state = randomBytes(16).toString("base64url");
    const invite = sanitizeInvite(new URL(req.url).searchParams.get("invite"));

    const res = NextResponse.redirect(
      buildAuthorizeUrl({ clientId: clientId.trim(), redirectUri, state }),
      302,
    );
    res.cookies.set(OAUTH_COOKIE, signState({ state, invite }, OAUTH_TTL_SEC), {
      ...sessionCookieOptions(OAUTH_TTL_SEC),
      maxAge: OAUTH_TTL_SEC,
    });
    return res;
  } catch (err) {
    // AUTH_SECRET 缺失 → 明确 503，不冒 500
    if (err instanceof AuthConfigError) {
      return fail(503, "auth_not_configured", err.message);
    }
    return internal("auth/login", err);
  }
}
