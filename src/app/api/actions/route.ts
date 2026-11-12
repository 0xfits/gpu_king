import { NextResponse } from "next/server";
import { fail, internal, ok, readJson } from "../../../lib/server/api";
import { requireSession } from "../../../lib/server/auth-guard";
import { applyActionToCompany } from "../../../lib/server/company-store";

/** 路由级强制动态：写库路由，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/actions
 * body: { slug, action, expectedVersion }
 *
 * 鉴权（P0 收口；顺序即响应优先级）：
 * - 无 / 无效 `gk_session` ⇒ **401 `unauthenticated`**（在 readJson 之前，零副作用）
 * - 结构校验失败 ⇒ 400 `bad_request`
 * - 公司不存在 ⇒ **404 `not_found`**
 * - 当前账号既非该公司任何成员位的 `discord_id` ⇒ **403 `not_member`**（不写库、不结算）
 *   成员位是「游戏内角色」而非权限边界：任一成员位的账号都能操作整个公司。
 *
 * 200 → { ok:true, state, version }
 * 409 → { ok:false, conflict:true, state, version }（state 为库内最新，未重放本次 action）
 * 4xx → { ok:false, error, msg }（非法 action / 公司不存在 / 非成员，不写库）
 */
export async function POST(req: Request) {
  try {
    // 0) 登录闸门：必须早于 readJson —— 未登录请求连请求体都不读，零副作用
    const auth = requireSession(req);
    if (!auth.ok) return auth.response;

    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail(400, "bad_request", "请求体必须是 JSON 对象");
    }
    const { slug, action, expectedVersion } = body as {
      slug?: unknown;
      action?: unknown;
      expectedVersion?: unknown;
    };
    if (typeof slug !== "string" || !slug.trim()) return fail(400, "bad_request", "缺少 slug");
    if (!Number.isInteger(expectedVersion) || (expectedVersion as number) < 0) {
      return fail(400, "bad_request", "expectedVersion 必须是非负整数");
    }
    // 归属校验在 applyActionToCompany 事务内完成：存在性(404) → 成员身份(403) → 版本(409) → 写
    const res = await applyActionToCompany(
      slug.trim().toLowerCase(),
      action,
      expectedVersion as number,
      auth.uid,
    );
    if (res.kind === "conflict") {
      return NextResponse.json(
        { ok: false, conflict: true, state: res.state, version: res.version },
        { status: 409, headers: { "cache-control": "no-store" } },
      );
    }
    if (res.kind === "error") return fail(res.status, res.error, res.msg);
    return ok({ state: res.state, version: res.version });
  } catch (err) {
    return internal("actions", err);
  }
}
