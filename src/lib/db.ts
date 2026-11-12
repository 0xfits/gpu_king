import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * pg 连接池（Neon Postgres）。
 *
 * - 单例挂在 globalThis 上：serverless 每次冷启动/每个模块实例只建一个池，
 *   避免「每请求新建池」把 Neon 连接数打爆。
 * - 连接串只从 process.env.DATABASE_URL 读取（.env.local，已 gitignore），
 *   绝不写进源码、绝不打印值；缺失时直接抛明确错误，不做静默降级。
 * - 数值口径：pg 把 numeric 读成 string、int8 读成 string，
 *   读回必须 Number() / ::int 后才能进 GameState；写入 numeric 用 String(n)。
 */

/** globalThis 上的池缓存键 */
const POOL_KEY = "__gpu_king_pg_pool__";

interface PoolGlobal {
  [POOL_KEY]?: Pool;
}

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new Error(
      "DATABASE_URL 未配置：请在 .env.local 写入 Neon Postgres 连接串（键名 DATABASE_URL，权限 600）。",
    );
  }
  return url.trim();
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: readDatabaseUrl(),
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
  });
  // 空闲客户端被服务端断开时不要让进程崩掉
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });
  return pool;
}

/** 取（或建）全局唯一的连接池 */
export function getPool(): Pool {
  const g = globalThis as unknown as PoolGlobal;
  if (!g[POOL_KEY]) g[POOL_KEY] = createPool();
  return g[POOL_KEY]!;
}

/** 参数化查询，返回行数组（numeric/int8 仍是 string，调用方自行 Number()） */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params === undefined ? undefined : [...params]);
  return res.rows;
}

/** 取第一行，没有则 null */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** 事务：fn 抛错自动 ROLLBACK，正常返回自动 COMMIT，连接必定归还池 */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* 连接已断，忽略 */
    }
    throw err;
  } finally {
    client.release();
  }
}

/** 关池（仅本地脚本收尾用；Serverless 进程由运行时回收） */
export async function closePool(): Promise<void> {
  const g = globalThis as unknown as PoolGlobal;
  const pool = g[POOL_KEY];
  if (!pool) return;
  delete g[POOL_KEY];
  await pool.end();
}
