import { fail, internal, ok } from "../../../../lib/server/api";
import { requireSession } from "../../../../lib/server/auth-guard";
import { inviteStatus } from "../../../../lib/server/invite-store";

/** 路由级强制动态：每请求读库，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * GET /api/invite/status?slug=<邀请方公司>
 *
 * - 无 / 无效 `gk_session` ⇒ **401 `unauthenticated`**
 * - 公司不存在 ⇒ 404 `not_found`
 * - ⇒ **200 `{ ok:true, slug, invitedCount, giftBoxes }`**
 *   （invitedCount = invites 表按 inviter_company 计数；gift_boxes = companies 冗余计数列）
 */
export async function GET(req: Request) {
  try {
    const auth = requireSession(req);
    if (!auth.ok) return auth.response;

    const slug = new URL(req.url).searchParams.get("slug")?.trim().toLowerCase();
    if (!slug) return fail(400, "bad_request", "缺少 slug 参数");

    const st = await inviteStatus(slug);
    if (!st) return fail(404, "not_found", `公司 ${slug} 不存在`);
    return ok({ slug, invitedCount: st.invitedCount, giftBoxes: st.giftBoxes });
  } catch (err) {
    return internal("invite/status", err);
  }
}
