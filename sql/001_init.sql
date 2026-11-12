-- gpu_king P0：Neon Postgres 初始 schema（幂等，可重复执行）
-- 执行方式：psql "$DATABASE_URL" -f sql/001_init.sql
-- 运行时同款 DDL 见 src/lib/server/schema.ts（首次 API 请求时 ensureSchema() 自动执行）。
-- 红线：neon_auth.* 为 Neon Auth 内置表，本文件不涉及、也绝不改动。

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
