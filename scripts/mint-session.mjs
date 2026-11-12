#!/usr/bin/env node
/**
 * 仅本地调试，生产禁用。
 *
 * 手工签发一条 gk_session cookie 值（与 src/lib/server/session.ts 同款算法：
 * base64url(JSON) + "." + base64url(HMAC-SHA256)，payload 含 iat/exp），
 * 用于在没有 Discord client_secret 的情况下本地验证 /api/auth/me 等鉴权分支。
 *
 * 用法：
 *   node scripts/mint-session.mjs --id test1 --name Tester
 *   node scripts/mint-session.mjs --id test1 --name Tester --exp-offset -60   # 已过期 60 秒
 *   node scripts/mint-session.mjs --secret-file /path/to/secret.txt --id u1
 *   V=$(node scripts/mint-session.mjs --id test1) && curl -s -b "gk_session=$V" http://127.0.0.1:5790/api/auth/me
 *
 * stdout 只打印 cookie 值；密钥只进内存，绝不打印。退出码 0 成功 / 1 失败（错误走 stderr）。
 */
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_TTL_SEC = 30 * 86400; // 与 session.ts 的 DEFAULT_SESSION_TTL_SEC 一致

function usage(msg) {
  if (msg) console.error(`mint-session: ${msg}`);
  console.error(
    "用法: node scripts/mint-session.mjs --id <discordId> [--name <显示名>] [--avatar <hash>] " +
      "[--exp-offset <秒>] [--ttl <秒>] [--secret-file <文件>]",
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = {
    id: null,
    name: undefined,
    avatar: undefined,
    expOffset: 0,
    ttl: DEFAULT_TTL_SEC,
    secretFile: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) usage(`缺少 ${a} 的值`);
      return v;
    };
    switch (a) {
      case "--id": out.id = next(); break;
      case "--name": out.name = next(); break;
      case "--avatar": out.avatar = next(); break;
      case "--exp-offset": out.expOffset = Number(next()); break;
      case "--ttl": out.ttl = Number(next()); break;
      case "--secret-file": out.secretFile = next(); break;
      case "-h": case "--help": usage(); break;
      default: usage(`未知参数 ${a}`);
    }
  }
  if (!out.id) usage("缺少 --id");
  if (!Number.isFinite(out.ttl) || out.ttl <= 0) usage("--ttl 必须是正数秒");
  if (!Number.isFinite(out.expOffset)) usage("--exp-offset 必须是数字秒");
  return out;
}

/** 从 KEY=VALUE 文本里取一个键（支持引号），只进内存不打印 */
function pickKey(text, key) {
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=\\s*(.*)$`, "m");
  const m = re.exec(text);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim() || null;
}

function readSecret(secretFile) {
  const candidates = [];
  if (secretFile) candidates.push(path.resolve(secretFile));
  else {
    candidates.push(path.join(ROOT, ".env.local"));
    candidates.push(path.join(ROOT, ".env"));
    candidates.push(path.join(ROOT, ".env.local.example")); // 兜底示例（通常没有真值）
  }
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const v = pickKey(readFileSync(f, "utf8"), "AUTH_SECRET");
    if (v) return v;
  }
  usage("读不到 AUTH_SECRET（用 --secret-file 指定文件，或检查仓库根 .env.local）");
  return null; // usage 已 exit
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const secret = readSecret(args.secretFile);

  const iat = Math.floor(Date.now() / 1000);
  // exp 默认 = 现在 + ttl；给了 --exp-offset 则直接以「现在」为基准偏移（-60 = 已过期 60 秒）
  const exp =
    process.argv.includes("--exp-offset")
      ? iat + Math.floor(args.expOffset)
      : iat + Math.floor(args.ttl) + Math.floor(args.expOffset);
  const payload = { uid: args.id, iat, exp };
  if (args.name !== undefined) payload.name = args.name;
  if (args.avatar !== undefined) payload.avatar = args.avatar;

  const encoded = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = createHmac("sha256", secret).update(encoded, "utf8").digest("base64url");

  // stdout 只有 cookie 值一行
  process.stdout.write(`${encoded}.${sig}\n`);
}

main();
