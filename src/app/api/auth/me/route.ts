import { displayName, getUser, upsertUser } from "../../../../lib/server/auth-store";
import { fail, internal, ok } from "../../../../lib/server/api";
import { companyForDiscordUser } from "../../../../lib/server/company-store";
import {
  AuthConfigError,
  SESSION_COOKIE,
  parseCookies,
  verifySession,
} from "../../../../lib/server/session";

/** 路由级强制动态：每请求读 cookie + 查库，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 *
 * - 无 / 无效 / 过期 / 被篡改的 `gk_session` ⇒ **401 unauthenticated**
 * - 有效 ⇒ **200** `{ ok:true, user:{ id, name, avatar } }`
 *
 * 「以库为准」：签名校验通过后仍查 users 表，name = global_name || username（库字段），
 * avatar 也取库；cookie 里的 name/avatar 只在库里查不到该行时兜底
 * （例如本地 mint 的调试会话、或 users 表被清空过）。库中无此行时用已验签的
 * cookie 账号信息 upsert 一行，保证读取有据可依、后续修改也有落点。
 */
export async function GET(req: Request) {
  try {
    const cookies = parseCookies(req.headers.get("cookie"));

    let session: ReturnType<typeof verifySession>;
    try {
      session = verifySession(cookies[SESSION_COOKIE] ?? null);
    } catch (err) {
      // AUTH_SECRET 缺失 → 明确 503，不是 500、也不是 401
      if (err instanceof AuthConfigError) {
        return fail(503, "auth_not_configured", err.message);
      }
      throw err;
    }
    if (!session) {
      return fail(401, "unauthenticated", "未登录或会话已过期");
    }

    let row = await getUser(session.uid);
    if (!row) {
      row = await upsertUser({
        id: session.uid,
        username: session.name ?? null,
        global_name: null,
        avatar: session.avatar ?? null,
      });
    }
    if (!row) {
      return fail(500, "internal", "读取用户资料失败，请稍后重试");
    }

    return ok({
      user: {
        id: row.discord_id,
        name: displayName(row) ?? session.uid,
        avatar: row.avatar ?? session.avatar ?? null,
      },
      // 已绑定公司时带上（客户端据此决定「云模式：加载存档」还是「新建公司」）
      // 未绑定 / 查询失败 ⇒ null（客户端按「无公司」走新建流程，不阻塞登录）
      company: await companyForDiscordUser(row.discord_id).catch(() => null),
    });
  } catch (err) {
    return internal("auth/me", err);
  }
}
