import { fail, internal, ok, readJson } from "../../../../lib/server/api";
import { requireSession } from "../../../../lib/server/auth-guard";
import { claimInvite } from "../../../../lib/server/invite-store";

/** 路由级强制动态：写库路由，禁止构建期静态化 */
export const dynamic = "force-dynamic";

/**
 * POST /api/invite/claim
 * body: { inviter: string }（邀请方公司 slug）
 *
 * - 无 / 无效 `gk_session` ⇒ **401 `unauthenticated`**
 * - inviter 不存在 ⇒ 404 `not_found`；已解散 ⇒ 400 `dissolved`
 * - 当前账号已是该公司成员 ⇒ **400 `self_invite`**（防自邀）
 * - 同一账号重复领取 ⇒ **200 `{ ok:true, alreadyClaimed:true, grantedUsd:0 }`**
 *   （幂等：不重复发钱、不再加礼盒）
 * - 新领取 ⇒ **200 `{ ok:true, grantedUsd:200, giftBoxes:<新值>, alreadyClaimed:false }`**
 */
export async function POST(req: Request) {
  try {
    const auth = requireSession(req);
    if (!auth.ok) return auth.response;

    const body = await readJson(req);
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return fail(400, "bad_request", "请求体必须是 JSON 对象");
    }
    const { inviter } = body as { inviter?: unknown };
    if (typeof inviter !== "string" || !inviter.trim()) {
      return fail(400, "bad_request", "缺少 inviter");
    }

    const res = await claimInvite({
      discordId: auth.uid,
      inviter,
      name: auth.name ?? null,
    });
    if (res.kind === "error") return fail(res.status, res.error, res.msg);
    return ok({
      grantedUsd: res.grantedUsd,
      giftBoxes: res.giftBoxes,
      alreadyClaimed: res.alreadyClaimed,
    });
  } catch (err) {
    return internal("invite/claim", err);
  }
}
