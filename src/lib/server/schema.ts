import { getPool } from "../db";

/**
 * 幂等建表：CREATE TABLE IF NOT EXISTS，可在任意时刻重复执行。
 * 与 sql/001_init.sql 保持同款（改一处请同步另一处）。
 *
 * 执行时机：**首次 API 请求时**（ensureSchema() 内），绝不在 build 期跑——
 * 构建机上没有 Neon 连接，且建表属于运行时副作用。
 */
export const SCHEMA_SQL = `
create table if not exists users (
  discord_id text primary key,
  username text,
  global_name text,
  avatar text,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists companies (
  id text primary key,
  name text not null,
  usd numeric(24,6) not null default 0,
  dividends numeric(24,6) not null default 0,
  hash numeric(24,6) not null default 0,
  capacity numeric(24,6) not null default 0,
  state jsonb not null,
  state_version integer not null default 1,
  last_settled_at timestamptz not null default now(),
  owner_discord_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_usd_idx on companies (usd desc);
create index if not exists companies_hash_idx on companies (hash desc);

create table if not exists company_members (
  company_id text not null references companies(id) on delete cascade,
  member_id text not null,
  discord_id text,
  display_name text not null,
  primary key (company_id, member_id)
);

create table if not exists game_logs (
  id bigserial primary key,
  company_id text not null references companies(id) on delete cascade,
  k text not null, p jsonb, at timestamptz not null default now()
);

create index if not exists game_logs_company_idx on game_logs (company_id, at desc);
`;

/** 模块级 promise：整个进程只建一次表，后续请求直接 await 同一个结果 */
let schemaPromise: Promise<void> | null = null;

async function runEnsureSchema(): Promise<void> {
  // 单条多语句查询（无参数），pg 走 simple query protocol，整体在一个隐式事务里
  await getPool().query(SCHEMA_SQL);
}

/** 首次调用执行建表，之后复用缓存的 promise；失败则清缓存允许下次重试 */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = runEnsureSchema().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
