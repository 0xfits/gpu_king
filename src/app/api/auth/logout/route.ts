import { fail, internal, ok } from "../../../../lib/server/api";
import { SESSION_COOKIE, sessionCookieOptions } from "../../../../lib/server/session";

/** 路由级强制动态：每请求读 cookie，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * 清 `gk_session`（maxAge=0，同属性覆盖）→ { ok:true }。
 * 服务端无状态会话，登出即删 cookie；旧值在有效期内技术上仍可自验，
 * 后续如需「立刻失效」再加 sessions 黑名单（本轮不做）。
 */
export async function POST() {
  try {
    const res = ok({ loggedOut: true });
    res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    return res;
  } catch (err) {
    return internal("auth/logout", err);
  }
}
