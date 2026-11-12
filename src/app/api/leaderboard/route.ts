import { fail, internal, ok } from "../../../lib/server/api";
import { leaderboard } from "../../../lib/server/company-store";

/** 路由级强制动态：每请求读库，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard?kind=usd|hash&limit=6&self=<slug>
 * → { ok:true, rows:[{ name, usd|hash, self? }] }
 * 真实数据排行（冗余列排序），供下一阶段把 page.tsx 的本地模拟榜切过来。
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "usd";
    if (kind !== "usd" && kind !== "hash") {
      return fail(400, "bad_request", "kind 只能是 usd 或 hash");
    }
    const rawLimit = Number(url.searchParams.get("limit") ?? "6");
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 6;
    const self = url.searchParams.get("self");
    const rows = await leaderboard(kind, limit, self);
    return ok({ rows });
  } catch (err) {
    return internal("leaderboard", err);
  }
}
