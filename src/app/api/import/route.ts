import { fail, internal, ok, readJson } from "../../../lib/server/api";
import { requireSession } from "../../../lib/server/auth-guard";
import { createFromLocal } from "../../../lib/server/company-store";

/** 路由级强制动态：写库路由，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/import
 * body: { state } —— 浏览器 localStorage 里的完整 GameState（gpu-king-v8 存档）。
 *
 * **必须登录**（`gk_session`）：导入即把存档归属到当前 Discord 账号。
 * - 无 / 无效会话 ⇒ **401 `unauthenticated`**（AUTH_SECRET 缺失 ⇒ 503 `auth_not_configured`），
 *   **先鉴权后读 body，未登录零写入**
 * - 200 → { ok:true, slug, version:1, grantedUsd, memberId }
 *   （同一事务内：`companies.owner_discord_id` + 该成员位 `company_members.discord_id`
 *   绑定为当前 discord_id；`users.grant_usd` 累加进 `state.grants[memberId]` 后归零）
 * - 409 → { ok:false, error:"exists", msg }（slug 已存在，整体回滚，赠金不被吃掉）
 * - 400 → { ok:false, error:"invalid_state", msg }（结构校验失败，不写库）
 */
export async function POST(req: Request) {
  try {
    const auth = requireSession(req);
    if (!auth.ok) return auth.response;

    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail(400, "bad_request", "请求体必须是 JSON 对象");
    }
    const raw = body as { state?: unknown; slug?: unknown };
    const res = await createFromLocal(
      raw.state,
      auth.uid,
      typeof raw.slug === "string" ? raw.slug : null,
    );
    if (!res.ok) return fail(res.status, res.error, res.msg);
    return ok({
      slug: res.slug,
      version: res.version,
      grantedUsd: res.grantedUsd,
      memberId: res.memberId,
    });
  } catch (err) {
    return internal("import", err);
  }
}
