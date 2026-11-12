#!/usr/bin/env node
/**
 * P0 数据层自检（不留脏数据）：
 *   连库 → ensureSchema() → 插一条临时公司 → 读回校验 → 删掉 → 校验行数复原 → 打印 ok
 *
 * 运行：node scripts/db-check.mjs
 * 说明：Node 18 不能直接 import TS，这里用已装的 typescript 把
 *       src/lib/db.ts + src/lib/server/schema.ts 转译成 CJS 后 require（不额外加依赖）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v; // 只进内存，绝不打印
  }
}
loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env"));
loadEnv(path.join(os.homedir(), ".config/neon/gpu-tycoon.env"));

if (!process.env.DATABASE_URL) {
  console.error("db-check: 缺少 DATABASE_URL（.env.local / ~/.config/neon/gpu-tycoon.env）");
  process.exit(1);
}

// 1) 转译 TS → CJS（保持目录结构，相对 import 不变）
const ts = require("typescript");
const OUT = path.join(ROOT, "node_modules/.cache/gpu-king-dbcheck");
const FILES = [
  ["src/lib/db.ts", "db.js"],
  ["src/lib/server/schema.ts", "server/schema.js"],
];
for (const [src, dst] of FILES) {
  const code = readFileSync(path.join(ROOT, src), "utf8");
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: src,
  });
  const dest = path.join(OUT, dst);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, outputText);
}

const db = require(path.join(OUT, "db.js"));
const schema = require(path.join(OUT, "server/schema.js"));

const TEMP_ID = "__dbcheck__";

function fail(msg) {
  console.error("db-check FAIL:", msg);
  process.exitCode = 1;
}

async function countCompanies() {
  const rows = await db.query("select count(*)::int as n from companies");
  return Number(rows[0].n);
}

try {
  await schema.ensureSchema(); // 幂等建表

  // 先清掉可能的历史残留，保证从干净状态开始计数
  await db.query("delete from companies where id = $1", [TEMP_ID]);
  const before = await countCompanies();

  const state = JSON.stringify({
    usd: 1.5,
    dividends: 0,
    hash: 2.5,
    capacity: 0,
    companyRep: { dev: 50, factory: 55, media: 40, ai: 50 },
    wallets: {},
    donations: {},
    purchases: {},
    items: {},
    owned: {},
    members: [{ id: "u1", name: "A", contribution: 0, rep: { dev: 70, factory: 55, media: 60, ai: 50 } }],
    org: { name: "DBCHECK", members: ["u1"] },
    activeId: "u1",
    proposal: null,
    rng: 1,
    log: [],
    lastSave: Date.now(),
  });

  await db.query(
    `insert into companies (id, name, usd, hash, capacity, state, state_version)
     values ($1, 'DBCHECK', $2, $3, 0, $4, 1)`,
    [TEMP_ID, "1.5", "2.5", state],
  );

  const rows = await db.query("select name, usd, hash, state from companies where id = $1", [TEMP_ID]);
  if (rows.length !== 1) throw new Error("读回行数不为 1");
  if (rows[0].name !== "DBCHECK") throw new Error("name 读回不符");
  if (Number(rows[0].usd) !== 1.5) throw new Error(`usd 读回不符：${rows[0].usd}`);
  if (Number(rows[0].hash) !== 2.5) throw new Error(`hash 读回不符：${rows[0].hash}`);
  const back = typeof rows[0].state === "string" ? JSON.parse(rows[0].state) : rows[0].state;
  if (back.usd !== 1.5) throw new Error("state jsonb 读回不符");

  const midCount = await countCompanies();
  await db.query("delete from companies where id = $1", [TEMP_ID]);
  const after = await countCompanies();

  if (after !== before) {
    throw new Error(`清理后行数不复原：before=${before} after=${after}`);
  }
  if (midCount !== before + 1) {
    throw new Error(`插入后行数异常：before=${before} mid=${midCount}`);
  }

  console.log(`ok (companies before=${before} mid=${midCount} after=${after})`);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await db.closePool(); // 关池，让进程能退出
}
