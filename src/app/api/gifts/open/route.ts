import { fail, internal, ok, readJson } from "../../../../lib/server/api";
import { requireSession } from "../../../../lib/server/auth-guard";
import { openGift } from "../../../../lib/server/company-store";

/** 路由级强制动态：写库路由，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/gifts/open
 * body: { slug: string, giftId: string }
 *
 * - 无 / 无效 `gk_session` ⇒ **401 `unauthenticated`**
 * - 当前账号不是该公司成员（company_members.discord_id 未命中）⇒ **403 `not_member`**
 * - 礼盒已开启 / 不存在 ⇒ **400 `gift_not_openable`**（不写库）
 * - 公司不存在 ⇒ 404 `not_found`
 * - ⇒ **200 `{ ok:true, donationId, labelKey, repGain, domain, repValue, companyRep, version }`**
 *   （repValue = 公司声望在抽中域的新值；随机由 reducer 内确定性 rng 选出）
 */
export async function POST(req: Request) {
  try {
    const auth = requireSession(req);
    if (!auth.ok) return auth.response;

    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail(400, "bad_request", "请求体必须是 JSON 对象");
    }
    const { slug, giftId } = body as { slug?: unknown; giftId?: unknown };
    if (typeof slug !== "string" || !slug.trim()) return fail(400, "bad_request", "缺少 slug");
    if (typeof giftId !== "string" || !giftId.trim()) return fail(400, "bad_request", "缺少 giftId");

    const res = await openGift(slug.trim().toLowerCase(), giftId.trim(), auth.uid);
    if (res.kind === "error") return fail(res.status, res.error, res.msg);

    return ok({
      donationId: res.gift.donationId,
      labelKey: res.gift.labelKey,
      repGain: res.gift.repGain,
      domain: res.gift.domain,
      repValue: res.companyRep[res.gift.domain],
      companyRep: res.companyRep,
      version: res.version,
    });
  } catch (err) {
    return internal("gifts/open", err);
  }
}
