-- gpu_king P0：Neon Postgres 初始 schema（幂等，可重复执行）
-- 执行方式：psql "$DATABASE_URL" -f sql/001_init.sql
-- 运行时同款 DDL 见 src/lib/server/schema.ts（首次 API 请求时 ensureSchema() 自动执行）。
-- 红线：neon_auth.* 为 Neon Auth 内置表，本文件不涉及、也绝不改动。

-- 用户：Discord 账号权威数据（P1a OAuth 登录落库；cookie 里的 name/avatar 只作兜底）
create table if not exists users (
  discord_id text primary key,                 -- Discord user id
  username text,                               -- Discord username（唯一化前的原始名）
  global_name text,                            -- 展示名，优先于 username
  avatar text,                                 -- Discord avatar hash（非 URL）
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

-- 公司：id 直接用 slug（公司名小写，唯一），state 为完整 GameState 的权威副本
create table if not exists companies (
  id text primary key,                    -- 用 slug 作为主键（公司名唯一）
  name text not null,
  usd numeric(24,6) not null default 0,
  dividends numeric(24,6) not null default 0,
  hash numeric(24,6) not null default 0,
  capacity numeric(24,6) not null default 0,
  state jsonb not null,                   -- 完整 GameState（权威副本）
  state_version integer not null default 1,
  last_settled_at timestamptz not null default now(),
  owner_discord_id text,                  -- P0 可空，P1 填（Discord 登录后写入）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_usd_idx on companies (usd desc);
create index if not exists companies_hash_idx on companies (hash desc);

-- 成员：游戏内成员 id（u1/u2/u3）与 Discord 身份的映射；P0 discord_id 全空
create table if not exists company_members (
  company_id text not null references companies(id) on delete cascade,
  member_id text not null,                -- 游戏内成员 id：u1/u2/u3
  discord_id text,                        -- P0 可空（本地导入的历史成员没有 Discord 身份）
  display_name text not null,             -- A/B/C
  primary key (company_id, member_id)
);

-- 日志：消息键 + 参数（p 存 LogEntry.p），时间用 timestamptz
create table if not exists game_logs (
  id bigserial primary key,
  company_id text not null references companies(id) on delete cascade,
  k text not null, p jsonb, at timestamptz not null default now()
);

create index if not exists game_logs_company_idx on game_logs (company_id, at desc);

-- —— P1b 增量：邀请奖励 + 礼盒（幂等，可在已有库上重复执行）——
-- 受邀人待注入赠金（个人钱包，仅限出资）
alter table users add column if not exists grant_usd numeric(24,6) not null default 0;
-- 邀请方公司未开启礼盒计数（冗余快速读；权威列表在 companies.state.gifts）
alter table companies add column if not exists gift_boxes integer not null default 0;

-- 邀请记录：invited_discord_id 唯一 ⇒ 同一账号只算一次（发钱/发礼盒的幂等基础）
create table if not exists invites (
  id bigserial primary key,
  inviter_company text not null references companies(id) on delete cascade,
  invited_discord_id text not null unique,   -- 同一账号只算一次
  invitee_company text,
  granted_usd numeric(24,6) not null default 200,
  gift_granted boolean not null default true,
  claimed_at timestamptz not null default now()
);

create index if not exists invites_inviter_idx on invites (inviter_company);
