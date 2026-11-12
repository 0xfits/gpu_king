import { randomUUID } from "node:crypto";
import { query, withTx } from "../db";
import { repairState, type GameState, type LogEntry } from "../game";
import { insertLogs } from "./company-store";
import { ensureSchema } from "./schema";

/**
 * P1b 邀请奖励数据层（邀请注册赠金 + 邀请方礼盒）。
 *
 * 口径红线：
 * - **幂等基础 = `invites.invited_discord_id` 唯一约束**：同一 Discord 账号全站只算一次，
 *   重复领取走 `on conflict do nothing`（0 行受影响 ⇒ alreadyClaimed，**不重复发钱、不再加礼盒**）。
 * - 发 200 赠金（`users.grant_usd`）与加 1 礼盒（`companies.gift_boxes` + `state.gifts`）
 *   与邀请行插入在**同一事务**内完成，回滚即全部作废。
 * - 写 numeric 一律 String(n)，读回一律 Number()（pg numeric/int8 → string）。
 * - 防自邀：当前账号已是该公司 `company_members.discord_id` 成员 ⇒ 400 `self_invite`。
 */

/** 每个新用户经邀请注册可得的赠金（USD，仅限出资，不可提现/消费） */
export const INVITE_GRANT_USD = 200;

const dec = (n: number): string => String(Number.isFinite(n) ? n : 0);

function parseState(v: unknown): GameState {
  if (typeof v === "string") return JSON.parse(v) as GameState;
  if (typeof v === "object" && v !== null) return v as GameState;
  throw new Error("companies.state 不是合法 JSON");
}

export interface ClaimInput {
  /** 当前登录的 Discord user id（受邀人） */
  discordId: string;
  /** 邀请方公司 slug */
  inviter: string;
  /** 受邀人展示名：仅在 users 首行插入时使用，绝不覆盖已有 Discord 资料 */
  name?: string | null;
}

export type ClaimOutcome =
  | { kind: "ok"; grantedUsd: number; giftBoxes: number; alreadyClaimed: boolean }
  | { kind: "error"; status: number; error: string; msg: string };

/**
 * 领取邀请奖励。
 * 1) 邀请方公司必须存在且 `state.org` 未解散；2) 防自邀；3) 幂等插入 invites；
 * 4) 新领取：`users.grant_usd += 200`、`companies.gift_boxes += 1`、
 *    `state.gifts` 追加未开启礼盒（`state_version + 1`）；5) 两条 game_logs。
 */
export async function claimInvite(input: ClaimInput): Promise<ClaimOutcome> {
  const slug = typeof input.inviter === "string" ? input.inviter.trim().toLowerCase() : "";
  const discordId = input.discordId;
  if (!slug || typeof discordId !== "string" || discordId === "") {
    return { kind: "error", status: 400, error: "bad_request", msg: "缺少 inviter" };
  }

  await ensureSchema();
  return withTx<ClaimOutcome>(async (client): Promise<ClaimOutcome> => {
    // 1) 锁住邀请方公司行：防止并发双发礼盒（写 state.gifts 必须串行）
    const rows = await client.query<{
      id: string;
      state: unknown;
      state_version: number;
      gift_boxes: number;
    }>(
      "select id, state, state_version, gift_boxes from companies where id = $1 for update",
      [slug],
    );
    const row = rows.rows[0];
    if (!row) {
      return { kind: "error", status: 404, error: "not_found", msg: `公司 ${slug} 不存在` };
    }
    const state = repairState(parseState(row.state));
    if (!state.org) {
      return { kind: "error", status: 400, error: "dissolved", msg: `公司 ${slug} 已解散` };
    }

    // 2) 防自邀：本人已是该公司成员
    const mem = await client.query(
      "select 1 as x from company_members where company_id = $1 and discord_id = $2",
      [slug, discordId],
    );
    if (mem.rowCount) {
      return {
        kind: "error",
        status: 400,
        error: "self_invite",
        msg: "该账号已是此公司成员，不能自邀",
      };
    }

    // 3) 幂等闸门：同一账号全站只算一次（0 行受影响 ⇒ 已领过，直接返回，不写任何东西）
    const ins = await client.query(
      `insert into invites (inviter_company, invited_discord_id, granted_usd, gift_granted)
       values ($1, $2, $3, true)
       on conflict (invited_discord_id) do nothing`,
      [slug, discordId, dec(INVITE_GRANT_USD)],
    );
    if (!ins.rowCount) {
      const cur = await client.query<{ gift_boxes: number }>(
        "select gift_boxes from companies where id = $1",
        [slug],
      );
      return {
        kind: "ok",
        grantedUsd: 0,
        giftBoxes: Number(cur.rows[0]?.gift_boxes ?? 0),
        alreadyClaimed: true,
      };
    }

    // 4a) 发 200 赠金（无 users 行则插入；已存在只累加 grant_usd，不动 Discord 资料）
    await client.query(
      `insert into users (discord_id, username, grant_usd) values ($1, $2, $3)
       on conflict (discord_id) do update set grant_usd = users.grant_usd + excluded.grant_usd`,
      [discordId, input.name ?? null, dec(INVITE_GRANT_USD)],
    );

    // 4b) 邀请方公司 +1 礼盒（冗余计数列 + 权威 state.gifts，版本号同时推进）
    const giftBoxes = Number(row.gift_boxes) + 1;
    const now = Date.now();
    const gift = { id: `gift_${randomUUID()}`, opened: false, at: now, from: slug };
    const entries: LogEntry[] = [
      { k: "log.inviteJoin", p: { d: discordId, usd: INVITE_GRANT_USD }, at: now },
      { k: "log.inviteGift", p: { from: slug, boxes: giftBoxes }, at: now },
    ];
    const next: GameState = {
      ...state,
      gifts: [...(state.gifts ?? []), gift],
      // 展示层日志：最新在前
      log: [entries[1], entries[0], ...(state.log ?? [])].slice(0, 40),
    };

    const upd = await client.query(
      `update companies
          set state = $1, gift_boxes = $2, state_version = $3, updated_at = now()
        where id = $4 and state_version = $5`,
      [JSON.stringify(next), giftBoxes, Number(row.state_version) + 1, slug, row.state_version],
    );
    if (!upd.rowCount) {
      return {
        kind: "error",
        status: 409,
        error: "conflict",
        msg: "公司状态刚被其它操作更新，请重试",
      };
    }

    // 5) 两条历史日志（game_logs）
    await insertLogs(client, slug, entries);

    return { kind: "ok", grantedUsd: INVITE_GRANT_USD, giftBoxes, alreadyClaimed: false };
  });
}

export interface InviteStatus {
  invitedCount: number;
  giftBoxes: number;
}

/** 邀请方视角的状态：累计成功邀请人数（invites 计数）+ 未开启礼盒计数 */
export async function inviteStatus(slug: string): Promise<InviteStatus | null> {
  const id = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!id) return null;
  await ensureSchema();
  const rows = await query<{ invited: string; gift_boxes: number }>(
    `select (select count(*) from invites where inviter_company = $1) as invited,
            c.gift_boxes
       from companies c
      where c.id = $1`,
    [id],
  );
  const r = rows[0];
  if (!r) return null;
  return { invitedCount: Number(r.invited), giftBoxes: Number(r.gift_boxes) };
}
