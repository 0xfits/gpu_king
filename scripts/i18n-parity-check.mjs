#!/usr/bin/env node
/**
 * i18n 词典对称性检查：zh-Hant / en 两套键必须**数量相等且键集合一致**。
 * 运行：node scripts/i18n-parity-check.mjs
 * 说明：把 TS 词典转译成 CJS 后直接从源码里抽键（不依赖任何构建产物）。
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

const OUT = path.join(ROOT, "node_modules/.cache/gpu-king-i18n");
const code = readFileSync(path.join(ROOT, "src/lib/i18n.ts"), "utf8");
const { outputText } = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: "src/lib/i18n.ts",
});
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "i18n.js"), outputText);
const mod = require(path.join(OUT, "i18n.js"));

/** 用 t() 反查是否命中：缺失键会原样返回键名 */
const keysOf = (lang) => {
  const seen = new Set();
  const src = code;
  // 词典对象在源码里以 `const zh: Dict = {` / `const en: Dict = {` 开头，按块切出键名
  const start = src.indexOf(lang === "en" ? "const en: Dict = {" : "const zh: Dict = {");
  const end = src.indexOf("\n};", start);
  const block = src.slice(start, end);
  for (const m of block.matchAll(/^\s{2}"([^"]+)":/gm)) seen.add(m[1]);
  return seen;
};

const zh = keysOf("zh-Hant");
const en = keysOf("en");
const onlyZh = [...zh].filter((k) => !en.has(k)).sort();
const onlyEn = [...en].filter((k) => !zh.has(k)).sort();

console.log(`zh-Hant keys: ${zh.size}`);
console.log(`en keys     : ${en.size}`);
console.log(`only-zh     : ${JSON.stringify(onlyZh)}`);
console.log(`only-en     : ${JSON.stringify(onlyEn)}`);

// 抽样反查：确认词典真的被 t() 命中（避免只改注释不改词典）
const probe = mod.t("zh-Hant", "vote.titleNaming", { name: "DRAGON" });
console.log(`probe t(zh, vote.titleNaming) = ${probe}`);

const ok = zh.size === en.size && onlyZh.length === 0 && onlyEn.length === 0;
console.log(ok ? "i18n parity ok" : "i18n parity MISMATCH");
process.exit(ok ? 0 : 1);
