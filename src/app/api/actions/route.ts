import { NextResponse } from "next/server";
import { fail, internal, ok, readJson } from "../../../lib/server/api";
import { applyActionToCompany } from "../../../lib/server/company-store";

/** 路由级强制动态：写库路由，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/actions
 * body: { slug, action, expectedVersion }
 * 200 → { ok:true, state, version }
 * 409 → { ok:false, conflict:true, state, version }（state 为库内最新，未重放本次 action）
 * 4xx → { ok:false, error, msg }（非法 action / 公司不存在 / 参数错误，不写库）
 *
 * P0 无鉴权：任何客户端都能以任意 slug 提交 action，P1 需按成员身份收口。
 */
export async function POST(req: Request) {
  try {
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
    const res = await applyActionToCompany(
      slug.trim().toLowerCase(),
      action,
      expectedVersion as number,
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
