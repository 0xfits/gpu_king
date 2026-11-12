import { fail, internal, ok } from "../../../lib/server/api";
import { getCompany } from "../../../lib/server/company-store";

/** 路由级强制动态：每请求读库并结算，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * GET /api/state?slug=<slug>：完整 GameState + version（供 P1 客户端接管存档）。
 *
 * ⚠️ P0 无鉴权：任何访客都能读到任意公司的完整 state。
 * P1 Discord OAuth 上线后必须按 companies.owner_discord_id / company_members.discord_id
 * 收口为「仅本人才可读」，并把本路由标记为 private。
 */
export async function GET(req: Request) {
  try {
    const slug = new URL(req.url).searchParams.get("slug")?.trim().toLowerCase();
    if (!slug) return fail(400, "bad_request", "缺少 slug 参数");
    const snap = await getCompany(slug);
    if (!snap) return fail(404, "not_found", `公司 ${slug} 不存在`);
    // 读取即结算：getCompany 已把 24h 封顶的利息/HASH 写回库
    return ok({ state: snap.state, version: snap.version });
  } catch (err) {
    return internal("state", err);
  }
}
