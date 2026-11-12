#!/usr/bin/env node
/**
 * P1b 双池 / 礼盒 reducer 断言（纯函数，不连库、不留数据）。
 *
 * 运行：node scripts/p1b-state-check.mjs
 * 说明：Node 不能直接 import TS，这里用已装的 typescript 把 src/lib/game.ts
 *       转译成 CJS 后 require（与 scripts/db-check.mjs 同款做法）。
 *
 * 覆盖：
 *   1) 旧存档（gpu-king-v8 结构，无新字段）过 repairState 不抛错且补默认值
 *   2) found 时优先扣 grants，不足再扣 wallets，并记 funding.fromGrants
 *   3) recruit（归队补缴）同样优先扣 grants；资金不足 → 返回同一引用
 *   4) 分红拆分：fromGrants=100 / total=200 ⇒ 一半进 lockedWallets
 *   5) openGift：确定性 rng（同输入同输出）、重复开 → 同一引用
 *   6) buy / topup 消费只动公司账户，grants / lockedWallets 两池分毫不动
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

const OUT = path.join(ROOT, "node_modules/.cache/gpu-king-p1bcheck");
const code = readFileSync(path.join(ROOT, "src/lib/game.ts"), "utf8");
const { outputText } = ts.transpileModule(code, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: "src/lib/game.ts",
});
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "game.js"), outputText);
const g = require(path.join(OUT, "game.js"));

const j = (v) => JSON.stringify(v);
let n = 0;
const fails = [];
function check(name, cond, detail) {
  n += 1;
  if (cond) {
    console.log(`ok ${n} - ${name}`);
  } else {
    fails.push(name);
    console.log(`FAIL ${n} - ${name} :: ${detail === undefined ? "" : j(detail)}`);
  }
}
function eq(a, b) {
  return Math.abs(a - b) < 1e-9;
}

// ————————————————————————————————————————————————————————————————
// 1) 旧存档兼容：gpu-king-v8 结构（无 grants/lockedWallets/gifts/funding）
// ————————————————————————————————————————————————————————————————
const legacy = g.initialState(42);
delete legacy.grants;
delete legacy.lockedWallets;
delete legacy.gifts;
delete legacy.funding;
let repaired = null;
let thrown = null;
try {
  repaired = g.repairState(legacy);
} catch (err) {
  thrown = err;
}
check("旧存档过 repairState 不抛错", !thrown, thrown && thrown.message);
check("repairState 补 grants 默认值", j(repaired?.grants) === "{}", repaired?.grants);
check("repairState 补 lockedWallets 默认值", j(repaired?.lockedWallets) === "{}", repaired?.lockedWallets);
check("repairState 补 gifts 默认值", Array.isArray(repaired?.gifts) && repaired.gifts.length === 0, repaired?.gifts);
check("repairState 补 funding 默认值", j(repaired?.funding) === "{}", repaired?.funding);

const dirty = {
  ...g.initialState(7),
  grants: "bad",
  lockedWallets: { u1: "x", u2: Number.NaN },
  gifts: "nope",
  funding: { u1: { total: "x", fromGrants: 999 } },
};
const dirtyOut = g.repairState(dirty);
check("脏新字段被规范成 {}", j(dirtyOut.grants) === "{}" && j(dirtyOut.gifts) === "[]", [dirtyOut.grants, dirtyOut.gifts]);
check("lockedWallets 非数字归 0", dirtyOut.lockedWallets.u1 === 0 && dirtyOut.lockedWallets.u2 === 0, dirtyOut.lockedWallets);
check("funding.fromGrants 不得大于 total", j(dirtyOut.funding) === "{}", dirtyOut.funding);

// ————————————————————————————————————————————————————————————————
// 2) found：优先扣 grants，不足再扣 wallets，记 funding（fromGrants 只记赠金部分）
// ————————————————————————————————————————————————————————————————
function dissolvedState(pools) {
  const s = g.initialState(11);
  return {
    ...s,
    org: null,
    usd: 100, // ≥ INCORPORATION_FEE
    grants: { u1: 0, u2: 0, u3: 0, ...(pools.grants ?? {}) },
    lockedWallets: { u1: 0, u2: 0, u3: 0, ...(pools.lockedWallets ?? {}) },
    wallets: { u1: 0, u2: 0, u3: 0, ...(pools.wallets ?? {}) },
    funding: pools.funding ?? {},
    log: [],
  };
}

const allGrants = dissolvedState({ grants: { u1: 200, u2: 200, u3: 200 } });
const r1 = g.applyAction(allGrants, { type: "found", name: "NEWCO" });
check("found 生效（org 建立）", r1 !== allGrants && r1.org?.name === "NEWCO", r1.org);
check(
  "found 优先扣 grants：三人赠金 200 → 0",
  r1.grants.u1 === 0 && r1.grants.u2 === 0 && r1.grants.u3 === 0,
  r1.grants,
);
check("found 未动个人钱包（grants 足够）", r1.wallets.u1 === 0 && r1.wallets.u2 === 0 && r1.wallets.u3 === 0, r1.wallets);
check(
  "found 记 funding：每人均 {total:200, fromGrants:200}",
  j(r1.funding) === j({ u1: { total: 200, fromGrants: 200 }, u2: { total: 200, fromGrants: 200 }, u3: { total: 200, fromGrants: 200 } }),
  r1.funding,
);
check("found 出资注入公司账户（100+600−100=600）", eq(r1.usd, 600), r1.usd);

const mixed = dissolvedState({ grants: { u1: 50 }, wallets: { u1: 1000 } });
const r2 = g.applyAction(mixed, { type: "found", name: "MIXED1" });
check("grants 不足时扣钱包：u1 赠金 50→0", r2.grants.u1 === 0, r2.grants);
check("钱包被扣 150（200−50）", eq(r2.wallets.u1, 850), r2.wallets);
check("fromGrants 只记赠金部分 {total:200, fromGrants:50}", j(r2.funding.u1) === j({ total: 200, fromGrants: 50 }), r2.funding);
check("未出过资的成员 funding 为空", r2.funding.u2 === undefined && r2.funding.u3 === undefined, r2.funding);

// 无赠金无钱包的老存档：行为与 P0 一致（不收钱、不记 funding）
const broke = dissolvedState({});
const r3 = g.applyAction(broke, { type: "found", name: "OLDWAY" });
check("老存档 found 不扣任何池", r3.wallets.u1 === 0 && r3.grants.u1 === 0, [r3.grants, r3.wallets]);
check("老存档 found 只缴注册费（100−100=0）", eq(r3.usd, 0), r3.usd);

// ————————————————————————————————————————————————————————————————
// 3) recruit（归队补缴）：优先扣 grants；资金不足 → 同一引用
// ————————————————————————————————————————————————————————————————
const rejoin = g.initialState(13);
const rejoinState = {
  ...rejoin,
  usd: 300, // rejoinCost = 100
  org: { name: "REJOIN1", members: ["u1", "", "u3"] },
  activeId: "u1",
  wallets: { u1: 0, u2: 0, u3: 0 },
  grants: { u1: 0, u2: 150, u3: 0 },
  lockedWallets: { u1: 0, u2: 0, u3: 0 },
  funding: {},
  log: [],
};
const r4 = g.applyAction(rejoinState, { type: "recruit", memberId: "u2" });
check("归队生效", r4 !== rejoinState && r4.org.members.includes("u2"), r4.org);
check("归队优先扣 grants（150−100=50）", eq(r4.grants.u2, 50), r4.grants);
check("归队不动钱包", eq(r4.wallets.u2, 0), r4.wallets);
check("归队记 funding {total:100, fromGrants:100}", j(r4.funding.u2) === j({ total: 100, fromGrants: 100 }), r4.funding);
check("补缴注入公司账户（300+100=400）", eq(r4.usd, 400), r4.usd);

const noMoney = { ...rejoinState, grants: { u1: 0, u2: 0, u3: 0 } };
const r5 = g.applyAction(noMoney, { type: "recruit", memberId: "u2" });
check("资金不足归队被拒（同一引用）", r5 === noMoney, r5 !== noMoney ? r5.grants : "ref-equal");

// ————————————————————————————————————————————————————————————————
// 4) 分红拆分：fromGrants=100 / total=200 ⇒ 一半进 lockedWallets
// ————————————————————————————————————————————————————————————————
const splitBase = g.initialState(17);
splitBase.funding = { u1: { total: 200, fromGrants: 100 } };
const split = g.splitByGrantShare(splitBase, "u1", 100);
check("splitByGrantShare(100) → 可支配 50 / 锁定 50", eq(split.spendable, 50) && eq(split.locked, 50), split);
check("grantShareRatio = 0.5", eq(g.grantShareRatio(splitBase, "u1"), 0.5), g.grantShareRatio(splitBase, "u1"));
const noFunding = g.initialState(19);
const split0 = g.splitByGrantShare(noFunding, "u1", 100);
check("无出资记录 → 全额可支配", eq(split0.locked, 0) && eq(split0.spendable, 100), split0);

// 离队结算集成：u1 辞职，分红 100 按 50% 拆进 lockedWallets
const quitState = {
  ...g.initialState(23),
  org: { name: "QUITCO", members: ["u1", "u2", "u3"] },
  activeId: "u1",
  usd: 500,
  dividends: 100,
  wallets: { u1: 0, u2: 0, u3: 0 },
  grants: { u1: 0, u2: 0, u3: 0 },
  lockedWallets: { u1: 0, u2: 0, u3: 0 },
  funding: { u1: { total: 200, fromGrants: 100 } },
  members: g.initialState(23).members.map((m) => ({ ...m, contribution: m.id === "u1" ? 1 : 0 })),
  log: [],
};
const r6 = g.applyAction(quitState, { type: "quit" });
check("辞职结算入钱包 100", eq(r6.wallets.u1, 100), r6.wallets);
check("按占比 50% 拆进 lockedWallets", eq(r6.lockedWallets.u1, 50), r6.lockedWallets);
check("spendableWallet = 50（wallets 不含锁定）", eq(g.spendableWallet(r6, "u1"), 50), g.spendableWallet(r6, "u1"));
check("lockedTotal = 50", eq(g.lockedTotal(r6, "u1"), 50), g.lockedTotal(r6, "u1"));

// ————————————————————————————————————————————————————————————————
// 5) openGift：确定性 rng、重复开 / 不存在 → 同一引用
// ————————————————————————————————————————————————————————————————
function giftState(seed) {
  const s = g.initialState(seed);
  return {
    ...s,
    gifts: [{ id: "gift_a", opened: false, at: Date.now(), from: "inv1" }],
    donations: {},
    funding: {},
  };
}
const gs = giftState(97);
const openA = g.applyAction(gs, { type: "openGift", giftId: "gift_a" });
check("openGift 改变状态", openA !== gs, "same ref");
const picked = g.DONATIONS.find((d) => (openA.donations[d.id] ?? 0) > (gs.donations[d.id] ?? 0));
check("抽中 DONATIONS 四项之一", !!picked, openA.donations);
check("礼盒 opened=true", openA.gifts[0].opened === true, openA.gifts);
check("donations[d]+1", picked && openA.donations[picked.id] === 1, openA.donations);
check(
  `公司 ${picked?.domain} 声望 +${picked?.repGain}`,
  !!picked && eq(openA.companyRep[picked.domain], gs.companyRep[picked.domain] + picked.repGain),
  { before: gs.companyRep, after: openA.companyRep },
);
check("rng 状态前进（确定性）", openA.rng !== gs.rng, [gs.rng, openA.rng]);
check("pendingGifts 开后归零", g.pendingGifts(openA).length === 0 && g.pendingGifts(gs).length === 1, [
  g.pendingGifts(gs).length,
  g.pendingGifts(openA).length,
]);

const gs2 = giftState(97);
const openB = g.applyAction(gs2, { type: "openGift", giftId: "gift_a" });
check("同输入同输出（无 Math.random）", j(openA) === j(openB), { a: openA.rng, b: openB.rng });

const again = g.applyAction(openA, { type: "openGift", giftId: "gift_a" });
check("重复开同一礼盒 → 同一引用", again === openA, "ref-equal");
const missing = g.applyAction(gs, { type: "openGift", giftId: "nope" });
check("不存在的礼盒 → 同一引用", missing === gs, "ref-equal");

// ————————————————————————————————————————————————————————————————
// 6) 消费通道只动公司账户，两池分毫不动
// ————————————————————————————————————————————————————————————————
const shop = {
  ...g.initialState(31),
  usd: 5000,
  grants: { u1: 200 },
  lockedWallets: { u1: 50 },
  wallets: { u1: 100 },
  funding: {},
  log: [],
};
const bought = g.applyAction(shop, { type: "buy", goodId: "jacket" });
check("buy 只扣公司账户", eq(bought.usd, 5000 - 800), bought.usd);
check("buy 不动 grants", eq(bought.grants.u1, 200), bought.grants);
check("buy 不动 lockedWallets", eq(bought.lockedWallets.u1, 50), bought.lockedWallets);
check("buy 不动 wallets", eq(bought.wallets.u1, 100), bought.wallets);

const topped = g.applyAction(shop, { type: "topup", region: "cn", amount: 100, usdCost: 14, rate: 7 });
check("topup 只扣公司账户", eq(topped.usd, 5000 - 14), topped.usd);
check("topup 不动 grants / lockedWallets / wallets", eq(topped.grants.u1, 200) && eq(topped.lockedWallets.u1, 50) && eq(topped.wallets.u1, 100), [
  topped.grants,
  topped.lockedWallets,
  topped.wallets,
]);
check("topup 后 spendableWallet 仍为 50", eq(g.spendableWallet(topped, "u1"), 50), g.spendableWallet(topped, "u1"));

// —— 汇总 ——
console.log(`\n${n - fails.length}/${n} passed`);
if (fails.length) {
  console.log(`FAILED: ${fails.join(" | ")}`);
  process.exit(1);
}
console.log("ok - P1b 双池/礼盒 reducer 断言全部通过");
