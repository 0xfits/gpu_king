import { NextResponse } from "next/server";
import { upsertUser } from "../../../../lib/server/auth-store";
import { fail, internal } from "../../../../lib/server/api";
import { resolveOrigin, sanitizeInvite } from "../../../../lib/server/oauth";
import {
  AuthConfigError,
  OAUTH_COOKIE,
  SESSION_COOKIE,
  DEFAULT_SESSION_TTL_SEC,
  parseCookies,
  safeEqual,
  sessionCookieOptions,
  signSession,
  verifyState,
} from "../../../../lib/server/session";

/** 路由级强制动态：每请求读 cookie / 环境，禁止构建期静态化 */
export const dynamic = "force-dynamic";

const TOKEN_URL = "https://discord.com/api/oauth2/token";
const ME_URL = "https://discord.com/api/users/@me";
const FETCH_TIMEOUT_MS = 15000;

interface DiscordTokenResponse {
  access_token?: string;
  token_type?: string;
}

interface DiscordProfile {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

/** 失败响应统一顺手清掉 gk_oauth，避免用户卡在坏 state 上 */
function badState(msg: string): NextResponse {
  const res = fail(400, "bad_state", msg);
  res.cookies.set(OAUTH_COOKIE, "", sessionCookieOptions(0));
  return res;
}

/**
 * GET /api/auth/callback?code=..&state=..
 *
 * 流程：验 gk_oauth 签名 state（常量时间比对 query state）→ 换 token → 取 @me
 *      → upsert users → 签 gk_session → 清 gk_oauth → 302（有 invite 则 /<slug>?invited=1）。
 * 任何阶段失败都返回 4xx/5xx JSON（token 失败 401，只回状态码不回响应体），
 * 绝不把 Discord 的响应体或任何密钥回显给客户端。
 */
export async function GET(req: Request) {
  const origin = resolveOrigin(req);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const cookies = parseCookies(req.headers.get("cookie"));
    const oauthState = verifyState(cookies[OAUTH_COOKIE] ?? null);

    if (!code || !stateParam || !oauthState || !safeEqual(stateParam, oauthState.state)) {
      return badState("OAuth state 校验失败（缺失、过期或不匹配），请重新点击登录。");
    }

    const clientId =
      process.env.DISCORD_CLIENT_ID || process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "";
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
    if (!clientId.trim() || !clientSecret.trim()) {
      const res = fail(503, "auth_not_configured", "缺少 DISCORD_CLIENT_SECRET（或 DISCORD_CLIENT_ID）");
      res.cookies.set(OAUTH_COOKIE, "", sessionCookieOptions(0));
      return res;
    }
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/callback`;

    // 1) code → access_token
    let tokenRes: Response;
    try {
      tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return fail(401, "token_exchange_failed", "Discord token 交换失败（网络错误或超时）");
    }
    if (!tokenRes.ok) {
      // 只回状态码，绝不回显 Discord 响应体（可能含敏感信息）
      return fail(401, "token_exchange_failed", `Discord token 交换失败（HTTP ${tokenRes.status}）`);
    }
    let token: DiscordTokenResponse;
    try {
      token = (await tokenRes.json()) as DiscordTokenResponse;
    } catch {
      return fail(401, "token_exchange_failed", "Discord token 交换失败（响应不是 JSON）");
    }
    if (!token.access_token) {
      return fail(401, "token_exchange_failed", "Discord token 交换失败（缺少 access_token）");
    }

    // 2) access_token → 用户资料
    let meRes: Response;
    try {
      meRes = await fetch(ME_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return fail(401, "user_fetch_failed", "获取 Discord 用户信息失败（网络错误或超时）");
    }
    if (!meRes.ok) {
      return fail(401, "user_fetch_failed", `获取 Discord 用户信息失败（HTTP ${meRes.status}）`);
    }
    let profile: DiscordProfile;
    try {
      profile = (await meRes.json()) as DiscordProfile;
    } catch {
      return fail(401, "user_fetch_failed", "获取 Discord 用户信息失败（响应不是 JSON）");
    }
    if (!profile.id) {
      return fail(401, "user_fetch_failed", "获取 Discord 用户信息失败（缺少用户 id）");
    }

    // 3) 落库（以 Discord 为权威）→ 签会话
    await upsertUser({
      id: profile.id,
      username: profile.username ?? null,
      global_name: profile.global_name ?? null,
      avatar: profile.avatar ?? null,
    });
    const sessionValue = signSession(
      {
        uid: profile.id,
        name: profile.global_name || profile.username || undefined,
        avatar: profile.avatar || undefined,
      },
      DEFAULT_SESSION_TTL_SEC,
    );

    // 4) 落地页：有 invite slug 则带邀请标记回跳，否则回首页
    const invite = sanitizeInvite(oauthState.invite);
    const dest = invite ? `/${invite}?invited=1` : "/";
    const res = NextResponse.redirect(`${origin}${dest}`, 302);
    res.cookies.set(SESSION_COOKIE, sessionValue, sessionCookieOptions(DEFAULT_SESSION_TTL_SEC));
    res.cookies.set(OAUTH_COOKIE, "", sessionCookieOptions(0));
    return res;
  } catch (err) {
    if (err instanceof AuthConfigError) {
      return fail(503, "auth_not_configured", err.message);
    }
    return internal("auth/callback", err);
  }
}
