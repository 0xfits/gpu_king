import { query, queryOne } from "../db";
import { ensureSchema } from "./schema";

/**
 * users 表读写（P1a：Discord OAuth 登录后落库的账号权威数据）。
 *
 * 口径红线：
 * - `discord_id` 即 Discord user id，主键；
 * - 每次登录 upsert：username/global_name/avatar 以 Discord 最新返回为准，
 *   `last_login_at = now()`；`created_at` 只在首次插入时写（on conflict 不碰）。
 * - 读侧（/api/auth/me）以本表为准，cookie 里的 name/avatar 只作兜底。
 */

export interface UserRow {
  discord_id: string;
  username: string | null;
  global_name: string | null;
  avatar: string | null;
  created_at: Date;
  last_login_at: Date;
}

export interface UpsertUserInput {
  id: string;
  username?: string | null;
  global_name?: string | null;
  avatar?: string | null;
}

/** 写入/更新一个 Discord 用户，返回落库后的整行 */
export async function upsertUser(input: UpsertUserInput): Promise<UserRow | null> {
  if (!input || typeof input.id !== "string" || input.id === "") {
    throw new Error("upsertUser: id 必须是非空字符串");
  }
  await ensureSchema();
  const rows = await query<UserRow>(
    `insert into users (discord_id, username, global_name, avatar, last_login_at)
     values ($1, $2, $3, $4, now())
     on conflict (discord_id) do update set
       username = excluded.username,
       global_name = excluded.global_name,
       avatar = excluded.avatar,
       last_login_at = now()
     returning discord_id, username, global_name, avatar, created_at, last_login_at`,
    [input.id, input.username ?? null, input.global_name ?? null, input.avatar ?? null],
  );
  return rows[0] ?? null;
}

/** 按 discord_id 读用户；不存在返回 null（不抛） */
export async function getUser(discordId: string): Promise<UserRow | null> {
  if (typeof discordId !== "string" || discordId === "") return null;
  await ensureSchema();
  return queryOne<UserRow>(
    `select discord_id, username, global_name, avatar, created_at, last_login_at
       from users where discord_id = $1`,
    [discordId],
  );
}

/** 展示名口径：global_name 优先，其次 username */
export function displayName(row: Pick<UserRow, "global_name" | "username"> | null): string | null {
  if (!row) return null;
  return row.global_name || row.username || null;
}
