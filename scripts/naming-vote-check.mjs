#!/usr/bin/env node
/**
 * 命名投票制 / Proposal 多态 reducer 断言（纯函数，不连库、不留数据）。
 *
 * 运行：node scripts/naming-vote-check.mjs
 * 说明：Node 不能直接 import TS，这里用已装的 typescript 把 src/lib/game.ts
 *       转译成 CJS 后 require（与 scripts/p1b-state-check.mjs 同款做法）。
 *
 * 覆盖：
 *   1) 旧存档兼容：proposal 无 kind（expand / kick:u2 编码）、org 无 nameLocked
 *      ⇒ repairState 不抛错，kind 补齐为 expand / kick，kickTargetId 仍可解析
 *   2) 命名投票闭环（3 人）：提名 ⇒ 提案 yes=1；第二票 ⇒ 达阈值 2 ⇒ 通过
 *      ⇒ org.name / fullName / nameLocked；再发 rename ⇒ 同一引用（被拒）
 *   3) 单人公司：passVotesFor=1，提名即通过（不卡死）
 *   4) 全称修改：proposeFullName ⇒ 表决通过 ⇒ 只换全称；非法全称被拒
 *   5) 罢免案回归：kind:"kick" + targetId 结构与旧编码都能读出目标
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const ts = require("typescript");

const OUT = path.join(ROOT, "node_modules/.cache/gpu-king-namingcheck");
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

// ————————————————————————————————————————————————————————————————
// 1) 旧存档兼容：proposal 无 kind、org 无 nameLocked
// ————————————————————————————————————————————————————————————————
const legacyExpand = {
  ...g.initialState(7),
  org: { name: "OLDCO", members: ["u1", "u2", "u3"] }, // 无 nameLocked / 无 fullName
  proposal: {
    gpuId: "gx256", // 旧格式：无 kind
    proposerId: "u1",
    yes: 1,
    no: 0,
    ballots: { u1: true },
    phase: "voting",
  },
};
let legacyOut = null;
try {
  legacyOut = g.repairState(legacyExpand);
  check("旧存档 repairState 不抛错", true);
} catch (e) {
  check("旧存档 repairState 不抛错", false, String(e));
}
check(
  "旧扩产提案补 kind=expand 且保留 gpuId",
  legacyOut.proposal?.kind === "expand" && legacyOut.proposal?.gpuId === "gx256",
  legacyOut.proposal,
);
check("旧存档 org 无 nameLocked ⇒ 已是非默认名视为锁定", legacyOut.org.nameLocked === true, legacyOut.org);
check("旧存档提案仍在投票中（1/2 票）", legacyOut.proposal?.phase === "voting", legacyOut.proposal?.phase);

const legacyKick = {
  ...g.initialState(8),
  org: { name: "OLDCO", members: ["u1", "u2", "u3"] },
  proposal: {
    gpuId: "kick:u2", // 旧编码：罢免意图藏在 gpuId 里
    proposerId: "u1",
    yes: 1,
    no: 0,
    ballots: { u1: true },
    phase: "voting",
  },
};
const legacyKickOut = g.repairState(legacyKick);
check(
  "旧罢免提案补 kind=kick + targetId=u2",
  legacyKickOut.proposal?.kind === "kick" && legacyKickOut.proposal?.targetId === "u2",
  legacyKickOut.proposal,
);
check(
  "kickTargetId 读新结构 targetId",
  g.kickTargetId(legacyKickOut.proposal) === "u2",
  g.kickTargetId(legacyKickOut.proposal),
);
check(
  "kickTargetId 兼容旧编码（未经 repair）",
  g.kickTargetId(legacyKick.proposal) === "u2",
  g.kickTargetId(legacyKick.proposal),
);
check(
  "旧罢免案 electorate 仍排除被罢免者（2 人投票）",
  g.electorateOf(legacyKickOut).join(",") === "u1,u3",
  g.electorateOf(legacyKickOut),
);

// 脏数据不得抛错：提案为字符串 / 缺字段
const dirty = { ...g.initialState(9), proposal: "nope" };
check("脏提案（字符串）被丢弃且不抛错", g.repairState(dirty).proposal === null);

// ————————————————————————————————————————————————————————————————
// 2) 命名投票闭环（3 人公司）
// ————————————————————————————————————————————————————————————————
const s0 = g.initialState(20261112); // org: GPU1（默认名，未锁定），3 名成员
check("开局未命名且未锁定", s0.org.name === g.DEFAULT_COMPANY_NAME && s0.org.nameLocked === false, s0.org);
check("3 人公司阈值 = 2", g.passVotesFor(s0) === 2, g.passVotesFor(s0));

const nom = g.applyAction(s0, { type: "found", name: "DRAGON", fullName: "龍火科技" });
check("提名创建 naming 提案（不再是直接改名）", nom.proposal?.kind === "naming", nom.proposal);
check("提案人 = activeId 且自投赞成 yes=1", nom.proposal?.yes === 1 && nom.proposal?.proposerId === "u1", nom.proposal);
check("提名不改 org（名字仍为默认）", nom.org.name === g.DEFAULT_COMPANY_NAME, nom.org);
check(
  "提名写入候选简称 + 全称",
  nom.proposal?.name === "DRAGON" && nom.proposal?.fullName === "龍火科技",
  nom.proposal,
);

const one = g.applyAction(nom, { type: "ballot", memberId: "u2", yes: true });
check("u2 赞成 ⇒ yes=2 达阈值 ⇒ 通过", one.proposal?.phase === "passed", one.proposal);
check("通过后 org.name=DRAGON", one.org.name === "DRAGON", one.org);
check("通过后 org.fullName=龍火科技", one.org.fullName === "龍火科技", one.org);
check("通过后 nameLocked=true", one.org.nameLocked === true, one.org);
check(
  "通过后日志为 log.named",
  one.log[0]?.k === "log.named",
  one.log[0],
);

const renamed = g.applyAction(one, { type: "rename", name: "OTHER1" });
check("锁定后 rename 返回同一引用（硬拒）", renamed === one, "ref-diff");
check("被拒后简称不变", renamed.org.name === "DRAGON", renamed.org);

// 再次提名同简称：已命名 ⇒ 直接拒绝
const renom = g.applyAction({ ...one, proposal: null }, { type: "found", name: "AGAIN" });
check("已命名公司再 found ⇒ 拒绝（名字与提案都不变）", renom.org.name === "DRAGON" && renom.proposal === null, [renom.org, renom.proposal]);

// 命名提案被拒 ⇒ org 不变，可重新提名
const rejected = g.applyAction(
  g.applyAction(nom, { type: "ballot", memberId: "u2", yes: false }),
  { type: "ballot", memberId: "u3", yes: false },
);
check("两票反对 ⇒ 提案未通过", rejected.proposal?.phase === "rejected", rejected.proposal);
check("未通过时 org 仍是默认名", rejected.org.name === g.DEFAULT_COMPANY_NAME, rejected.org);
const retry = g.applyAction({ ...rejected, proposal: null }, { type: "found", name: "RETRY1" });
check("被拒后可重新提名", retry.proposal?.kind === "naming" && retry.proposal?.name === "RETRY1", retry.proposal);

// ————————————————————————————————————————————————————————————————
// 3) 单人公司：阈值 1，提名即通过
// ————————————————————————————————————————————————————————————————
const solo = {
  ...g.initialState(21),
  org: { name: g.DEFAULT_COMPANY_NAME, members: ["u1", "", ""], nameLocked: false },
  activeId: "u1",
};
check("单人公司阈值 = 1", g.passVotesFor(solo) === 1, g.passVotesFor(solo));
const soloOut = g.applyAction(solo, { type: "found", name: "SOLO1" });
check("单人提名一票即过（不卡死）", soloOut.org.name === "SOLO1" && soloOut.org.nameLocked === true, soloOut.org);
check("单人命名提案 phase=passed", soloOut.proposal?.phase === "passed", soloOut.proposal);

// ————————————————————————————————————————————————————————————————
// 4) 全称修改：可反复投票，只换全称
// —————————————————————————————————────────────────——————
const locked = { ...one, proposal: null }; // DRAGON / 龍火科技 / nameLocked
const pf = g.applyAction(locked, { type: "proposeFullName", fullName: "Dragon Fire 9" });
check("proposeFullName 创建 fullName 提案", pf.proposal?.kind === "fullName", pf.proposal);
check("提案带新全称且自投 1 票", pf.proposal?.fullName === "Dragon Fire 9" && pf.proposal?.yes === 1, pf.proposal);
check("提案期间全称未变", pf.org.fullName === "龍火科技", pf.org);

const pfYes = g.applyAction(pf, { type: "ballot", memberId: "u2", yes: true });
check("全称表决通过", pfYes.proposal?.phase === "passed", pfYes.proposal);
check("通过后 fullName 变更", pfYes.org.fullName === "Dragon Fire 9", pfYes.org);
check("通过后 name（简称）不变", pfYes.org.name === "DRAGON", pfYes.org);
check("通过后 nameLocked 仍为 true", pfYes.org.nameLocked === true, pfYes.org);
check("通过后日志为 log.fullNameOk", pfYes.log[0]?.k === "log.fullNameOk", pfYes.log[0]);

// 可反复发起：再改一次
const pf2 = g.applyAction({ ...pfYes, proposal: null }, { type: "proposeFullName", fullName: "Dragon Fire 10" });
check("全称可反复发起（第二次提案）", pf2.proposal?.kind === "fullName" && pf2.proposal?.fullName === "Dragon Fire 10", pf2.proposal);

// 非法全称被拒：>24 字 / 含 <script>
const tooLong = "X".repeat(25);
const badLong = g.applyAction(locked, { type: "proposeFullName", fullName: tooLong });
check("超长全称（25 字）被拒 ⇒ 同一引用", badLong === locked, badLong.proposal);
const badScript = g.applyAction(locked, { type: "proposeFullName", fullName: "<script>x</script>" });
check("含 <script> 全称被拒 ⇒ 同一引用", badScript === locked, badScript.proposal);
const emptyFull = g.applyAction(locked, { type: "proposeFullName", fullName: "   " });
check("空白全称被拒 ⇒ 同一引用", emptyFull === locked, emptyFull.proposal);

// 未锁定（未命名）时不得发起全称修改
const notLocked = { ...s0, proposal: null };
const pfUnlocked = g.applyAction(notLocked, { type: "proposeFullName", fullName: "Whatever 1" });
check("未锁定简称 ⇒ proposeFullName 被拒", pfUnlocked === notLocked, pfUnlocked.proposal);

// 已有进行中提案 ⇒ 不得再发起（一次只办一个表决）
const busy = g.applyAction({ ...locked, proposal: pf.proposal }, { type: "proposeFullName", fullName: "Another 2" });
check("已有提案时 proposeFullName 被拒", busy.proposal?.fullName === "Dragon Fire 9", busy.proposal);

// naming 提案同样校验非法简称 / 非法全称
const badName = g.applyAction(s0, { type: "found", name: "123ABC" });
check("非法简称（数字开头）⇒ 同一引用", badName === s0, badName.proposal);
const badNameFull = g.applyAction(s0, { type: "found", name: "GOOD1", fullName: "<img>" });
check("非法全称（尖括号）⇒ 同一引用", badNameFull === s0, badNameFull.proposal);

// ————————————————————————————————————————————————————————————————
// 5) 罢免案回归：新结构仍能正确结算
// ————————————————————————————————————————————————————————————————
const kickState = {
  ...g.initialState(31),
  org: { name: "KICKCO", members: ["u1", "u2", "u3"], nameLocked: true },
  members: g.initialState(31).members.map((m) =>
    m.id === "u3" ? { ...m, contribution: 0 } : { ...m, contribution: 50 },
  ),
  activeId: "u1",
};
const kick = g.applyAction(kickState, { type: "kick", targetId: "u3" });
check("提出罢免案 kind=kick", kick.proposal?.kind === "kick" && kick.proposal?.targetId === "u3", kick.proposal);
check("罢免阈值 = 2（应投票人排除目标）", g.passVotesFor(kick) === 2, g.passVotesFor(kick));
const kickOut = g.applyAction(kick, { type: "ballot", memberId: "u2", yes: true });
check("两票赞成 ⇒ 罢免生效（席位留空）", kickOut.org.members.join(",") === "u1,u2,", kickOut.org);

console.log("");
if (fails.length === 0) {
  console.log(`all ${n} assertions passed`);
  process.exit(0);
}
console.log(`${fails.length}/${n} FAILED: ${fails.join(" | ")}`);
process.exit(1);
