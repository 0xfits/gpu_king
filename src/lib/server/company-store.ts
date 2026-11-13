import type { PoolClient } from "pg";
import { query, queryOne, withTx } from "../db";
import {
  DONATIONS,
  HASH_PASSIVE_SCALE,
  OFFLINE_CAP_SEC,
  RESERVED_SLUGS,
  SEC_PER_YEAR,
  annualYield,
  applyAction,
  isValidCompanyFullName,
  isValidCompanyName,
  normalizeCompanyFullName,
  repairState,
  slugFromName,
  type GameAction,
  type GameState,
  type LogEntry,
  type Member,
  type RepDomain,
  type RepSet,
} from "../game";
import { ensureSchema } from "./schema";

/**
 * 服务端权威数据层：结算（settle）、乐观锁写回（applyActionToCompany）、
 * 本地存档导入（createFromLocal）、真实排行（leaderboard）。
 *
 * 口径红线：
 * - settle 与 src/lib/game.ts 的 calcOfflineGain 完全一致：
 *   按真实经过秒数、上限 OFFLINE_CAP_SEC（24h）、USD 利息 floor 到 1e-6、HASH floor 到整数；
 *   dividends 不计入离线利息（与 calcOfflineGain 一致，客户端 tick 的口径差异见报告）。
 * - 结算只推进 last_settled_at，**不改 state_version**（结算不算一次版本变更）。
 * - pg numeric/int8 读回是 string，进 GameState 前一律 Number()；
 *   写 numeric 一律 String(n)（直接传 number 有被拒风险）。
 */

/** numeric 列写库值：非有限数兜底 0 */
const dec = (n: number): string => String(Number.isFinite(n) ? n : 0);

function toMs(v: Date | string | number): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : Number.NaN;
}

export interface SettleResult {
  state: GameState;
  changed: boolean;
  gained: { usd: number; hash: number };
  /** 原始经过秒数是否超过 24h 上限（被截断） */
  capped: boolean;
}

/**
 * 权威结算：按 last_settled_at → now 的真实经过秒数补 USD 年化利息与被动 HASH。
 * 纯函数（不碰库、不碰 Date.now 之外的时钟），返回值可直接写回 state.usd/hash。
 */
export function settle(
  state: GameState,
  lastSettledAt: Date | string | number,
  now: Date | number = Date.now(),
): SettleResult {
  const nowMs = now instanceof Date ? now.getTime() : now;
  const fromMs = toMs(lastSettledAt);
  const rawSec = Number.isFinite(fromMs) ? (nowMs - fromMs) / 1000 : 0;
  const capped = rawSec > OFFLINE_CAP_SEC;
  const sec = Math.min(Math.max(rawSec, 0), OFFLINE_CAP_SEC);
  const gained = { usd: 0, hash: 0 };
  if (!state.org || sec <= 0) return { state, changed: false, gained, capped };

  const usdGain = state.usd * annualYield(state) * (sec / SEC_PER_YEAR);
  const hashGain = state.capacity * HASH_PASSIVE_SCALE * sec;
  gained.usd = Math.floor(usdGain * 1e6) / 1e6;
  gained.hash = Math.floor(hashGain);
  if (gained.usd === 0 && gained.hash === 0) return { state, changed: false, gained, capped };

  return {
    state: { ...state, usd: state.usd + gained.usd, hash: state.hash + gained.hash, lastSave: nowMs },
    changed: true,
    gained,
    capped,
  };
}

interface CompanyRow {
  id: string;
  name: string;
  /** pg 会把 jsonb 自动解析成对象，字符串只在极少数路径出现 */
  state: unknown;
  state_version: number;
  last_settled_at: Date;
  updated_at: Date;
}

function parseState(v: unknown): GameState {
  if (typeof v === "string") return JSON.parse(v) as GameState;
  if (typeof v === "object" && v !== null) return v as GameState;
  throw new Error("companies.state 不是合法 JSON");
}

export interface CompanySnapshot {
  slug: string;
  state: GameState;
  version: number;
  updatedAt: Date;
}

/**
 * 读公司 → 结算 → 有变化则写回（state/冗余列 + last_settled_at=now()，不动 state_version）。
 * 返回 null 表示公司不存在。
 */
export async function getCompany(slug: string): Promise<CompanySnapshot | null> {
  await ensureSchema();
  const row = await queryOne<CompanyRow>(
    "select id, name, state, state_version, last_settled_at, updated_at from companies where id = $1",
    [slug],
  );
  if (!row) return null;

  const stored = parseState(row.state);
  const repaired = repairState(stored);
  const { state: settled, changed } = settle(repaired, row.last_settled_at, new Date());
  const repairedDiff = JSON.stringify(repaired) !== JSON.stringify(stored);

  if (changed || repairedDiff) {
    await query(
      `update companies
          set state = $1, usd = $2, hash = $3, capacity = $4, dividends = $5,
              last_settled_at = now(), updated_at = now()
        where id = $6`,
      [
        JSON.stringify(settled),
        dec(settled.usd),
        dec(settled.hash),
        dec(settled.capacity),
        dec(settled.dividends),
        slug,
      ],
    );
    return { slug, state: settled, version: row.state_version, updatedAt: new Date() };
  }
  return { slug, state: settled, version: row.state_version, updatedAt: row.updated_at };
}

export interface CompanySummary {
  name: string;
  usd: number;
  hash: number;
  capacity: number;
  dividends: number;
  memberCount: number;
  updatedAt: Date;
  version: number;
}

/** 公开只读视图（不结算、不写库，不返回完整 state） */
export async function getCompanySummary(slug: string): Promise<CompanySummary | null> {
  await ensureSchema();
  const rows = await query<{
    name: string;
    usd: string;
    hash: string;
    capacity: string;
    dividends: string;
    member_count: string;
    updated_at: Date;
    state_version: number;
  }>(
    `select c.name, c.usd, c.hash, c.capacity, c.dividends, c.state_version, c.updated_at,
            (select count(*) from company_members m where m.company_id = c.id)::int as member_count
       from companies c
      where c.id = $1`,
    [slug],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    name: r.name,
    usd: Number(r.usd),
    hash: Number(r.hash),
    capacity: Number(r.capacity),
    dividends: Number(r.dividends),
    memberCount: Number(r.member_count),
    updatedAt: r.updated_at,
    version: r.state_version,
  };
}

/**
 * 允许经 API 提交的 action（服务端权威：hydrate/tick 一律拒收）。
 * ⚠️ `openGift` **刻意不在此白名单**：礼盒开启必须走 /api/gifts/open（独立的开启语义 +
 *    幂等校验），不混进通用 /api/actions 的乐观锁写回。
 */
const ACTION_TYPES = new Set([
  "switch",
  "mine",
  "propose",
  "ballot",
  "kick",
  "quit",
  "recruit",
  "found",
  "rename",
  "donate",
  "buy",
  "topup",
  "close",
]);

/** 结构校验：类型合法 + 必填字段类型正确；不合法返回错误文案 */
function validateAction(raw: unknown): { action?: GameAction; error?: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "action 必须是对象" };
  }
  const a = raw as Record<string, unknown>;
  if (typeof a.type !== "string") return { error: "action.type 必须是字符串" };
  if (!ACTION_TYPES.has(a.type)) {
    return { error: `action 类型 ${a.type} 不允许经 API 提交（服务端权威结算）` };
  }
  switch (a.type) {
    case "switch":
    case "kick":
    case "recruit":
      if (typeof a.memberId !== "string") return { error: "action.memberId 必须是字符串" };
      break;
    case "ballot":
      if (typeof a.memberId !== "string" || typeof a.yes !== "boolean") {
        return { error: "ballot 需要 memberId(string) 与 yes(boolean)" };
      }
      break;
    case "propose":
      if (typeof a.gpuId !== "string") return { error: "action.gpuId 必须是字符串" };
      break;
    case "found":
    case "rename":
      if (typeof a.name !== "string") return { error: "action.name 必须是字符串" };
      break;
    case "donate":
      if (typeof a.donationId !== "string") return { error: "action.donationId 必须是字符串" };
      break;
    case "buy":
      if (typeof a.goodId !== "string") return { error: "action.goodId 必须是字符串" };
      break;
    case "topup":
      if (
        typeof a.region !== "string" ||
        typeof a.amount !== "number" ||
        typeof a.usdCost !== "number" ||
        typeof a.rate !== "number"
      ) {
        return { error: "topup 需要 region(string) 与 amount/usdCost/rate(number)" };
      }
      break;
    default:
      break;
  }
  return { action: raw as GameAction };
}

/**
 * 事务内写失败信号：`withTx` 只对「回调抛错」ROLLBACK，对「正常返回」一律 COMMIT。
 * 因此「已经写过东西之后才发现写不下去」的分支必须 throw（下方 catch 映射回 409）。
 */
class TxWriteFailed extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TxWriteFailed";
  }
}

/**
 * 同步成员位（`company_members` 是 state.members 的落库镜像）。
 *
 * ★ **绝不写 discord_id**：身份只能在「导入 / 入住」时显式绑定一次，写入点是
 *   `createFromLocal` 与 `joinCompany`。这里是 upsert 的 do update 只保留
 *   `display_name = excluded.display_name` —— 若这里也跟着写 `discord_id`，
 *   每次 action 都会把已有身份洗成 null（P1b 之前正是全库 NULL 的成因）。
 */
async function syncMembers(client: PoolClient, slug: string, members: Member[]): Promise<void> {
  for (const m of members) {
    // upsert：只更新显示名；discord_id 仅在新行插入时为 null，已有行原样保留
    await client.query(
      `insert into company_members (company_id, member_id, discord_id, display_name)
       values ($1, $2, null, $3)
       on conflict (company_id, member_id) do update set display_name = excluded.display_name`,
      [slug, m.id, m.name],
    );
  }
  await client.query(
    `delete from company_members where company_id = $1 and not (member_id = any($2::text[]))`,
    [slug, members.map((m) => m.id)],
  );
}

/**
 * 事务内读并锁住「待注入赠金」（`users.grant_usd`）；无该行 ⇒ 0。
 * 加锁是为了与并发入住/导入串行，避免同一笔赠金被注入两次。
 */
async function lockPendingGrant(client: PoolClient, discordId: string): Promise<number> {
  const r = await client.query<{ grant_usd: string | number }>(
    "select grant_usd from users where discord_id = $1 for update",
    [discordId],
  );
  const n = Number(r.rows[0]?.grant_usd ?? 0); // numeric 读回是 string
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 赠金已写进 `state.grants` ⇒ `users.grant_usd` 归零（同一事务内，紧跟注入写） */
async function clearPendingGrant(client: PoolClient, discordId: string): Promise<void> {
  await client.query("update users set grant_usd = $2 where discord_id = $1", [discordId, dec(0)]);
}

/** 写历史日志（game_logs 表；展示用的 state.log 由 reducer 维护，两处保持同键） */
export async function insertLogs(client: PoolClient, slug: string, entries: LogEntry[]): Promise<void> {
  for (const e of entries) {
    await client.query(
      `insert into game_logs (company_id, k, p, at) values ($1, $2, $3, $4)`,
      [slug, e.k, e.p ? JSON.stringify(e.p) : null, new Date(Number.isFinite(e.at) ? e.at : Date.now())],
    );
  }
}

export type ActionOutcome =
  | { kind: "ok"; state: GameState; version: number }
  | { kind: "conflict"; state: GameState; version: number }
  | { kind: "error"; status: number; error: string; msg: string };

/**
 * 乐观锁写入一次玩家操作：
 * 事务 → **公司存在性(404) → 成员归属(403)** → 结构校验(400) → SELECT ... FOR UPDATE → 结算 →
 * 版本校验 → applyAction → 校验 action 生效 → UPDATE（state_version = expectedVersion + 1）
 * → 同步 members/logs。
 *
 * 归属安全（P0）：`discordId` 必须是该公司**任一成员位**绑定的账号，否则 403 `not_member`。
 * 成员位是游戏内角色、不是权限边界 —— 任一绑定用户都能操作整个公司。
 * 存在性与成员校验都在本事务**第一条写语句之前**判失败 ⇒ 纯读校验，return 后 COMMIT 是空事务、零副作用
 * （审计顺序：先判存在性再判成员，否则「不存在的公司」会被成员查询误报成 403）。
 *
 * 版本不符：返回 conflict + **库里的最新 state**（不含本次 action 的重放结果）。
 * action 非法 / 阶段不合法（applyAction 返回同一引用）：4xx，不写库。
 */
export async function applyActionToCompany(
  slug: string,
  rawAction: unknown,
  expectedVersion: number,
  discordId: string,
): Promise<ActionOutcome> {
  // 防御：路由层已 401；这里空 uid 一律按未登录拒绝，绝不退化成「无鉴权」
  const uid = typeof discordId === "string" ? discordId.trim() : "";
  if (!uid) {
    return { kind: "error", status: 401, error: "unauthenticated", msg: "未登录或会话已过期" };
  }

  await ensureSchema();
  return withTx(async (client) => {
    // 0) 公司存在性：纯读，不存在 ⇒ 404（必须先于成员校验）
    const exists = await client.query("select 1 as x from companies where id = $1", [slug]);
    if (!exists.rowCount) {
      return { kind: "error", status: 404, error: "not_found", msg: `公司 ${slug} 不存在` } as ActionOutcome;
    }

    // 1) 归属校验：company_members 里任一成员位绑定了该账号即可（纯读，不写库）
    const mem = await client.query(
      "select 1 as x from company_members where company_id = $1 and discord_id = $2",
      [slug, uid],
    );
    if (!mem.rowCount) {
      return {
        kind: "error",
        status: 403,
        error: "not_member",
        msg: "只有该公司成员可以操作",
      } as ActionOutcome;
    }

    // 2) 结构校验（纯函数，不碰库）
    const v = validateAction(rawAction);
    if (!v.action) {
      return {
        kind: "error",
        status: 400,
        error: "invalid_action",
        msg: v.error ?? "非法 action",
      } as ActionOutcome;
    }
    const action = v.action;

    const rows = await client.query<CompanyRow>(
      "select id, name, state, state_version, last_settled_at from companies where id = $1 for update",
      [slug],
    );
    const row = rows.rows[0];
    if (!row) {
      return { kind: "error", status: 404, error: "not_found", msg: `公司 ${slug} 不存在` } as ActionOutcome;
    }

    const stored = parseState(row.state);
    const repaired = repairState(stored);
    const { state: settled } = settle(repaired, row.last_settled_at, Date.now());

    // 版本校验：不符则回传库里的最新状态（未应用本次 action）
    if (row.state_version !== expectedVersion) {
      return { kind: "conflict", state: settled, version: row.state_version } as ActionOutcome;
    }

    const next = applyAction(settled, action);
    if (next === settled) {
      // reducer 对「阶段不合法」返回同一引用：不写库，4xx
      return {
        kind: "error",
        status: 400,
        error: "invalid_action",
        msg: `action ${action.type} 不适用于当前状态`,
      } as ActionOutcome;
    }

    const prevLog = new Set(settled.log);
    const freshLogs = next.log.filter((e) => !prevLog.has(e)).slice(0, 20);
    const newName = next.org ? next.org.name : row.name; // slug（id）不重命名，仅同步展示名
    const newVersion = row.state_version + 1;

    const upd = await client.query(
      `update companies
          set state = $1, usd = $2, hash = $3, capacity = $4, dividends = $5, name = $6,
              state_version = $7, last_settled_at = now(), updated_at = now()
        where id = $8 and state_version = $9`,
      [
        JSON.stringify(next),
        dec(next.usd),
        dec(next.hash),
        dec(next.capacity),
        dec(next.dividends),
        newName,
        newVersion,
        slug,
        row.state_version,
      ],
    );
    if (!upd.rowCount) {
      // FOR UPDATE 下理论不可达；兜底回读最新版本，按冲突返回。
      // 安全前提：本条 update 是本事务的**第一条写语句**（之前只有 select for update），
      // 0 行受影响 ⇒ 库里什么都没变 ⇒ return 后 COMMIT 是空事务、零副作用。
      // ⚠ 若将来在这条 update 之前插入任何写语句，此分支必须改成 throw（让 withTx ROLLBACK）。
      const again = await client.query<CompanyRow>(
        "select state, state_version from companies where id = $1",
        [slug],
      );
      const r2 = again.rows[0];
      if (!r2) return { kind: "error", status: 404, error: "not_found", msg: `公司 ${slug} 不存在` } as ActionOutcome;
      return {
        kind: "conflict",
        state: parseState(r2.state),
        version: r2.state_version,
      } as ActionOutcome;
    }

    await syncMembers(client, slug, next.members);
    if (freshLogs.length) await insertLogs(client, slug, freshLogs);
    return { kind: "ok", state: next, version: newVersion } as ActionOutcome;
  });
}

export type ImportOutcome =
  | { ok: true; slug: string; version: number; grantedUsd: number; memberId: string }
  | { ok: false; status: number; error: string; msg: string };

/**
 * 把浏览器 localStorage 存档整体搬进 Postgres（**要求登录态**，无 session 由路由层 401）：
 * 校验结构 → repairState 补齐 → （事务内）锁 `users.grant_usd` → 注入 `state.grants[绑定位]` →
 * 插 companies（带 `owner_discord_id`）→ syncMembers → 该成员位绑 `discord_id` →
 * `users.grant_usd` 归零 → 最近 40 条 log。以上全在**同一事务**，任一步失败整体回滚。
 *
 * 绑定哪一位成员：`state.activeId`（不在册则回退 `members[0]`）。
 * slug 冲突（公司已存在）→ 409（insert 是本事务第一条写，抛错即回滚，赠金不会被吃掉）。
 *
 * @param discordId 当前登录账号的 Discord user id；null/undefined ⇒ 只导入不绑身份
 *                  （仅供离线迁移脚本用，路由层必须传真实 uid）。
 */
export async function createFromLocal(
  input: unknown,
  discordId: string | null = null,
): Promise<ImportOutcome> {
  await ensureSchema();
  const bad = (msg: string, error = "invalid_state", status = 400): ImportOutcome => ({
    ok: false,
    status,
    error,
    msg,
  });

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return bad("state 必须是对象");
  }
  const raw = input as Partial<GameState>;
  if (!Array.isArray(raw.members) || raw.members.length === 0) {
    return bad("state.members 必须是非空数组");
  }
  for (const m of raw.members) {
    if (typeof m !== "object" || m === null || typeof (m as Member).id !== "string" || typeof (m as Member).name !== "string") {
      return bad("state.members 元素必须含 id/name 字符串");
    }
  }
  const org = raw.org;
  if (!org || typeof org !== "object" || typeof org.name !== "string" || !isValidCompanyName(org.name)) {
    return bad("state.org.name 不是合法公司简称（1~6 位，字母在前、数字在后，且非保留字）");
  }
  // 全称可选：缺省/空串视为未填；给了就必须合法（≤24 字符，中英文/数字/空格与 - . & '）
  const fullName = normalizeCompanyFullName(org.fullName);
  if (fullName !== undefined && !isValidCompanyFullName(fullName)) {
    return bad("state.org.fullName 不是合法公司全称（1~24 字符，中英文、数字、空格与 - . & '，禁 <> 等符号）");
  }
  const slug = slugFromName(org.name);
  if (RESERVED_SLUGS.has(slug)) return bad(`slug ${slug} 是保留路径`, "reserved_slug");

  let state: GameState;
  try {
    state = repairState(raw as GameState);
  } catch {
    return bad("state 结构无法修复");
  }
  for (const k of ["usd", "dividends", "hash", "capacity"] as const) {
    if (!Number.isFinite(state[k])) return bad(`state.${k} 必须是有限数字`);
  }
  if (!Array.isArray(state.log)) state = { ...state, log: [] };
  // 服务端已是权威结算源：置为导入时刻，避免客户端按旧 lastSave 二次结算
  state = { ...state, lastSave: Date.now() };

  const owner = typeof discordId === "string" && discordId !== "" ? discordId : null;
  // 绑定哪一位成员：activeId 在册优先，否则第一位（导入后的身份归属）
  const bindMemberId =
    typeof state.activeId === "string" && state.members.some((m) => m.id === state.activeId)
      ? state.activeId
      : state.members[0]!.id;

  let grantedUsd = 0;
  try {
    await withTx(async (client) => {
      // 0) 赠金：先锁 users 行（纯读），无该行 ⇒ 0。写库前完成，失败可安全 return。
      grantedUsd = owner ? await lockPendingGrant(client, owner) : 0;
      const toWrite: GameState =
        grantedUsd > 0
          ? {
              ...state,
              grants: {
                ...state.grants,
                [bindMemberId]: (state.grants[bindMemberId] ?? 0) + grantedUsd,
              },
            }
          : state;

      // 1) 公司行（本事务第一条写；slug 冲突抛 23505 ⇒ 整体回滚，赠金不会被吃掉）
      await client.query(
        `insert into companies (id, name, usd, dividends, hash, capacity, state, state_version, last_settled_at, owner_discord_id)
         values ($1, $2, $3, $4, $5, $6, $7, 1, now(), $8)`,
        [
          slug,
          toWrite.org!.name,
          dec(toWrite.usd),
          dec(toWrite.dividends),
          dec(toWrite.hash),
          dec(toWrite.capacity),
          JSON.stringify(toWrite),
          owner,
        ],
      );
      await syncMembers(client, slug, toWrite.members);
      if (owner) {
        // 2) 身份绑定：syncMembers 刻意不写 discord_id，这里显式落库一次
        await client.query(
          "update company_members set discord_id = $2 where company_id = $1 and member_id = $3",
          [slug, owner, bindMemberId],
        );
        // 3) 赠金已进 state.grants ⇒ users.grant_usd 归零（同一事务）
        if (grantedUsd > 0) await clearPendingGrant(client, owner);
      }
      await insertLogs(client, slug, toWrite.log.slice(0, 40));
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, status: 409, error: "exists", msg: `公司 ${slug} 已存在` };
    }
    throw err;
  }
  return { ok: true, slug, version: 1, grantedUsd, memberId: bindMemberId };
}

export interface LeaderRow {
  name: string;
  usd?: number;
  hash?: number;
  self?: boolean;
}

/** 真实排行：直接按冗余列排序（只列仍在运营的公司，org 为 null 的不进榜） */
export async function leaderboard(
  kind: "usd" | "hash",
  limit: number,
  selfSlug?: string | null,
): Promise<LeaderRow[]> {
  await ensureSchema();
  const col = kind === "hash" ? "hash" : "usd"; // 白名单，杜绝注入
  const lim = Math.max(1, Math.min(50, Number.isFinite(limit) ? Math.trunc(limit) : 6));
  const rows = await query<{ id: string; name: string; usd: string; hash: string }>(
    `select id, name, usd, hash from companies
      where jsonb_typeof(state -> 'org') = 'object'
      order by ${col} desc, updated_at desc
      limit $1`,
    [lim],
  );
  return rows.map((r) => {
    const row: LeaderRow = { name: r.name };
    if (kind === "usd") row.usd = Number(r.usd);
    else row.hash = Number(r.hash);
    if (selfSlug && r.id === selfSlug) row.self = true;
    return row;
  });
}

// —— P1b：邀请赠金读取 + 成员身份校验 + 礼盒开启 ——

/**
 * 某 Discord 账号待注入的赠金（`users.grant_usd`）；无该行 → 0。
 * 只读版本（不写库、不加锁）——真实注入走 `createFromLocal` / `joinCompany` 事务内的
 * `lockPendingGrant`（SELECT ... FOR UPDATE），避免「查完到用之间」被并发吃掉。
 */
export async function pendingGrantFor(discordId: string): Promise<number> {
  if (typeof discordId !== "string" || discordId === "") return 0;
  await ensureSchema();
  const row = await queryOne<{ grant_usd: string | number }>(
    "select grant_usd from users where discord_id = $1",
    [discordId],
  );
  if (!row) return 0;
  const n = Number(row.grant_usd);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 是否为该公司在册成员（`company_members.discord_id` 命中即算） */
export async function isCompanyMember(slug: string, discordId: string): Promise<boolean> {
  if (!slug || !discordId) return false;
  await ensureSchema();
  const rows = await query<{ x: number }>(
    "select 1 as x from company_members where company_id = $1 and discord_id = $2",
    [slug, discordId],
  );
  return rows.length > 0;
}

export interface OpenGiftResult {
  /** 抽中的捐赠项（reducer 用确定性 rng 选，服务端从 donations 计数差回推） */
  gift: { donationId: string; labelKey: string; repGain: number; domain: RepDomain };
  /** 开启后的公司四域声望（调用方按 gift.domain 取该域新值） */
  companyRep: RepSet;
  version: number;
}

export type OpenGiftOutcome =
  | ({ kind: "ok" } & OpenGiftResult)
  | { kind: "error"; status: number; error: string; msg: string };

/**
 * 开启一个邀请礼盒（必须是该公司成员）：
 * 事务 → **公司存在性校验** → 成员校验 → SELECT ... FOR UPDATE → repair + settle →
 * applyAction(openGift) → 写回（state_version + 1）→ 补写 game_logs。
 *
 * 公司不存在 ⇒ 404 `not_found`（**先判存在性，再判成员身份**：反序会让「不存在的公司」
 * 因成员查询恒不命中而被误报成 403 `not_member`）；非成员 ⇒ 403 `not_member`；
 * 已开 / 不存在 ⇒ reducer 返回同一引用 ⇒ 400 `gift_not_openable`（不写库）。
 * 以上三条都在本事务**第一条写语句之前**判失败 ⇒ 纯读校验，return 后 COMMIT 是空事务、零副作用。
 */
export async function openGift(
  slug: string,
  giftId: string,
  discordId: string,
): Promise<OpenGiftOutcome> {
  await ensureSchema();
  return withTx<OpenGiftOutcome>(async (client): Promise<OpenGiftOutcome> => {
    // 0) 公司存在性：先查（纯读），不存在 ⇒ 404。必须先于成员校验。
    const exists = await client.query("select 1 as x from companies where id = $1", [slug]);
    if (!exists.rowCount) {
      return { kind: "error", status: 404, error: "not_found", msg: `公司 ${slug} 不存在` };
    }

    const mem = await client.query(
      "select 1 as x from company_members where company_id = $1 and discord_id = $2",
      [slug, discordId],
    );
    if (!mem.rowCount) {
      return {
        kind: "error",
        status: 403,
        error: "not_member",
        msg: "只有该公司成员可以开启礼盒",
      };
    }

    const rows = await client.query<CompanyRow>(
      "select id, name, state, state_version, last_settled_at from companies where id = $1 for update",
      [slug],
    );
    const row = rows.rows[0];
    if (!row) {
      return { kind: "error", status: 404, error: "not_found", msg: `公司 ${slug} 不存在` };
    }

    const stored = repairState(parseState(row.state));
    const { state: settled } = settle(stored, row.last_settled_at, Date.now());
    const next = applyAction(settled, { type: "openGift", giftId });
    if (next === settled) {
      return {
        kind: "error",
        status: 400,
        error: "gift_not_openable",
        msg: "礼盒不存在或已开启",
      };
    }

    const picked = DONATIONS.find(
      (d) => (next.donations[d.id] ?? 0) > (settled.donations[d.id] ?? 0),
    );
    if (!picked) throw new Error("openGift 后未找到抽中的捐赠项（reducer 异常）");

    const prevLog = new Set(settled.log);
    const freshLogs = next.log.filter((e) => !prevLog.has(e)).slice(0, 20);
    const newVersion = row.state_version + 1;
    // gift_boxes 是「未开启礼盒」冗余计数：开启成功即 -1（与 state.gifts 保持一致）
    const upd = await client.query(
      `update companies
          set state = $1, usd = $2, hash = $3, capacity = $4, dividends = $5,
              gift_boxes = greatest(gift_boxes - 1, 0),
              state_version = $6, last_settled_at = now(), updated_at = now()
        where id = $7 and state_version = $8`,
      [
        JSON.stringify(next),
        dec(next.usd),
        dec(next.hash),
        dec(next.capacity),
        dec(next.dividends),
        newVersion,
        slug,
        row.state_version,
      ],
    );
    if (!upd.rowCount) {
      // 同上：本条 update 是本事务第一条写语句（前面只有 select / select ... for update），
      // 0 行受影响 ⇒ 无任何落库 ⇒ return 409 安全。
      // ⚠ 若将来在这条 update 之前插入任何写语句，必须改成 throw 回滚。
      return {
        kind: "error",
        status: 409,
        error: "conflict",
        msg: "公司状态刚被其它操作更新，请重试",
      };
    }
    if (freshLogs.length) await insertLogs(client, slug, freshLogs);

    return {
      kind: "ok",
      gift: {
        donationId: picked.id,
        labelKey: picked.labelKey,
        repGain: picked.repGain,
        domain: picked.domain,
      },
      companyRep: next.companyRep,
      version: newVersion,
    };
  });
}

// —— P1c：入驻（把一个空闲成员位绑定给登录账号 + 赠金注入）——

export type JoinOutcome =
  | {
      kind: "ok";
      /** 绑定的成员位（如 u2） */
      memberId: string;
      /** 之前已是该公司成员（幂等：不重复注入赠金） */
      alreadyMember: boolean;
      /** 本次注入 `state.grants` 的赠金（USD）；已注入过一次则为 0 */
      grantedUsd: number;
      /** 写库后的 state_version */
      version: number;
    }
  | { kind: "error"; status: number; error: string; msg: string };

/**
 * 让登录账号入住某公司：把该公司**一个 `discord_id is null` 的成员位**绑定给它，
 * 并把 `users.grant_usd` 注入该位的 `state.grants`（同一事务）。
 *
 * 分支（顺序即优先级）：
 * - 公司不存在 ⇒ `{ kind:"error", status:404, error:"not_found" }`
 * - 已是成员 ⇒ `{ kind:"ok", memberId, alreadyMember:true }`（幂等，不写库、不再吃赠金）
 * - 无空位 ⇒ `{ kind:"error", status:409, error:"no_vacancy" }`（纯读校验，零写入）
 * - 成功 ⇒ `{ kind:"ok", memberId, alreadyMember:false, grantedUsd, version }`
 *
 * 锁序与 `applyActionToCompany` 一致（companies 行 → company_members 行 → users 行），
 * 避免与并发 action / 并发入住互锁。
 * 写后失败（版本不符）必须 throw 让 withTx ROLLBACK —— 此时身份已落库。
 */
export async function joinCompany(slug: string, discordId: string): Promise<JoinOutcome> {
  const id = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!id || typeof discordId !== "string" || discordId === "") {
    return { kind: "error", status: 400, error: "bad_request", msg: "缺少公司 slug 或未登录" };
  }

  await ensureSchema();
  return withTx<JoinOutcome>(async (client): Promise<JoinOutcome> => {
    // 1) 锁公司行（先判存在性：不存在 ⇒ 404，而不是被空位查询误报成 409）
    const rows = await client.query<CompanyRow>(
      "select id, name, state, state_version, last_settled_at from companies where id = $1 for update",
      [id],
    );
    const row = rows.rows[0];
    if (!row) {
      return { kind: "error", status: 404, error: "not_found", msg: `公司 ${id} 不存在` };
    }

    // 2) 已是成员 ⇒ 幂等成功（纯读，未写任何东西）
    const mine = await client.query<{ member_id: string }>(
      "select member_id from company_members where company_id = $1 and discord_id = $2 order by member_id limit 1",
      [id, discordId],
    );
    if (mine.rows[0]) {
      return {
        kind: "ok",
        memberId: mine.rows[0].member_id,
        alreadyMember: true,
        grantedUsd: 0,
        version: Number(row.state_version),
      };
    }

    // 3) 找空位并锁住该成员行；无空位 ⇒ 409（仍是纯读）
    const vacancy = await client.query<{ member_id: string }>(
      `select member_id from company_members
        where company_id = $1 and discord_id is null
        order by member_id
        limit 1
        for update`,
      [id],
    );
    const memberId = vacancy.rows[0]?.member_id;
    if (!memberId) {
      return { kind: "error", status: 409, error: "no_vacancy", msg: "该公司没有空缺的成员位" };
    }

    // 4) 赠金（事务内加锁读；无 users 行 ⇒ 0）
    const grantedUsd = await lockPendingGrant(client, discordId);

    // 5) 身份绑定 —— 本事务第一条写语句；0 行受影响 ⇒ 什么都没写 ⇒ return 安全
    const bind = await client.query(
      `update company_members set discord_id = $3
        where company_id = $1 and member_id = $2 and discord_id is null`,
      [id, memberId, discordId],
    );
    if (!bind.rowCount) {
      // 已 for update 锁住该行，理论不可达；此时本事务仍未写入任何数据
      return { kind: "error", status: 409, error: "no_vacancy", msg: "该成员位刚被占用，请重试" };
    }

    let version = Number(row.state_version);
    if (grantedUsd > 0) {
      const stored = repairState(parseState(row.state));
      const { state: settled, changed } = settle(stored, row.last_settled_at, Date.now());
      const now = Date.now();
      const next: GameState = {
        ...settled,
        grants: { ...settled.grants, [memberId]: (settled.grants[memberId] ?? 0) + grantedUsd },
        lastSave: changed ? settled.lastSave : now,
      };
      const newVersion = version + 1;
      const upd = await client.query(
        `update companies
            set state = $1, usd = $2, hash = $3, capacity = $4, dividends = $5,
                state_version = $6, last_settled_at = now(), updated_at = now()
          where id = $7 and state_version = $8`,
        [
          JSON.stringify(next),
          dec(next.usd),
          dec(next.hash),
          dec(next.capacity),
          dec(next.dividends),
          newVersion,
          id,
          version,
        ],
      );
      if (!upd.rowCount) {
        // ★ 必须 throw：身份已在第 5 步写入，return 会被 withTx 当作成功 COMMIT ⇒
        //   留下「已入住但赠金没进 state」的半截状态。throw ⇒ 整体回滚。
        throw new TxWriteFailed("join_state_update_failed");
      }
      await clearPendingGrant(client, discordId);
      version = newVersion;
    }

    return { kind: "ok", memberId, alreadyMember: false, grantedUsd, version };
  }).catch((err: unknown): JoinOutcome => {
    if (err instanceof TxWriteFailed) {
      return {
        kind: "error",
        status: 409,
        error: "conflict",
        msg: "公司状态刚被其它操作更新，请重试（本次入住已整体回滚，未产生任何写入）",
      };
    }
    throw err;
  });
}
