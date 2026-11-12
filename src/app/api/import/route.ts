import { fail, internal, ok, readJson } from "../../../lib/server/api";
import { createFromLocal } from "../../../lib/server/company-store";

/** 路由级强制动态：写库路由，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/import
 * body: { state } —— 浏览器 localStorage 里的完整 GameState（gpu-king-v8 存档）。
 * 200 → { ok:true, slug, version }（version 恒为 1）
 * 409 → { ok:false, error:"exists", msg }（slug 已存在）
 * 400 → { ok:false, error:"invalid_state", msg }（结构校验失败，不写库）
 *
 * P0 无鉴权：导入即建公司，P1 需绑定 owner_discord_id 并限制重复导入。
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail(400, "bad_request", "请求体必须是 JSON 对象");
    }
    const res = await createFromLocal((body as { state?: unknown }).state);
    if (!res.ok) return fail(res.status, res.error, res.msg);
    return ok({ slug: res.slug, version: res.version });
  } catch (err) {
    return internal("import", err);
  }
}
