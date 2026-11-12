import { NextResponse } from "next/server";
import { fail, internal } from "../../../../lib/server/api";
import { getCompanySummary } from "../../../../lib/server/company-store";

/** 路由级强制动态：公司数据每请求实时读库，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * GET /api/company/[slug]：公开只读视图（排行榜/分享卡片用）。
 * 只返回冗余列与计数，**不返回完整 state**；不结算、不写库。
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const id = (slug ?? "").trim().toLowerCase();
    if (!id) return fail(400, "bad_request", "缺少 slug");
    const summary = await getCompanySummary(id);
    if (!summary) return fail(404, "not_found", `公司 ${id} 不存在`);
    return NextResponse.json(
      {
        ok: true,
        name: summary.name,
        usd: summary.usd,
        hash: summary.hash,
        capacity: summary.capacity,
        dividends: summary.dividends,
        memberCount: summary.memberCount,
        updatedAt: summary.updatedAt.toISOString(),
        version: summary.version,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return internal("company", err);
  }
}
