"use client";

/**
 * 公司经营区块（Co 页与 /<slug> 公开页共用，禁止各写一份）：
 * - CompanyRepPanel：公司声望·品牌
 * - Shareholders：三位股东（成员切换 / 贡献 / 声望 / 钱包 / 罢免·归队 / 辞职）
 * - GpuGenerations：表决面板 + GPU 世代列表（扩产提案）
 *
 * readOnly=true 时用于公开页：切换、罢免、归队、扩产、投票全部 disabled（不隐藏，
 * 让访客看得到规则与在办表决，但无法操作）。
 */

import {
  GPUS,
  YIELD_PER_HASH,
  activeMembers,
  canBeKicked,
  companyComposite,
  compositeRep,
  expandGpuId,
  gpuById,
  kickTargetId,
  linkedComposite,
  memberById,
  passVotesFor,
  rejoinCost,
  successChance,
} from "../lib/game";
import { memberLabel, t } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import { RepBars } from "./rep-bars";
import { badge, panel, voteBtn } from "./ui";
import {
  IconAlertTriangle,
  IconBanknote,
  IconCheckCircle,
  IconDoorOpen,
  IconMegaphone,
  IconPickaxe,
  IconUser,
  IconXCircle,
} from "./icons";

/** 表决阶段 → 颜色（render helper：避免 JSX 嵌套三元） */
function phaseColor(phase: string): string {
  if (phase === "passed") return "#76b900";
  if (phase === "failed") return "#f55";
  return "#fa0";
}

/** 表决阶段 → 文案键 */
function phaseLabelKey(phase: string): string {
  if (phase === "passed") return "vote.passed";
  if (phase === "failed") return "vote.failed";
  return "vote.rejected";
}

/** 表决阶段 → 图标 */
function PhaseIcon({ phase }: { phase: string }) {
  if (phase === "passed") return <IconCheckCircle size={16} />;
  if (phase === "failed") return <IconXCircle size={16} />;
  return <IconAlertTriangle size={16} />;
}

/** 公司声望 · 品牌（两页共用） */
export function CompanyRepPanel() {
  const { state, lang } = useGame();
  return (
    <div style={{ ...panel, borderColor: "#3a3a5a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconMegaphone size={15} />
        <span style={{ fontWeight: "bold", fontSize: 13 }}>{t(lang, "companyRep.title")}</span>
        <span style={{ ...badge, color: "#8ab4f8", marginLeft: "auto" }}>
          {companyComposite(state).toFixed(1)}
        </span>
      </div>
      <div style={{ maxWidth: 260 }}>
        <RepBars rep={state.companyRep} lang={lang} height={52} />
      </div>
      <p style={{ fontSize: 10, color: "#666", margin: "8px 0 0" }}>{t(lang, "companyRep.link")}</p>
    </div>
  );
}

/** 三位股东：切换当前操作成员、贡献/声望/钱包、罢免与归队、辞职 */
export function Shareholders({ readOnly = false }: { readOnly?: boolean }) {
  const { state, dispatch, lang } = useGame();
  const crew = activeMembers(state);
  const active = memberById(state, state.activeId);
  const contributionTotal = crew.reduce(
    (s, id) => s + (memberById(state, id)?.contribution ?? 0),
    0,
  );
  const rejoinFee = rejoinCost(state);
  const myDividend =
    contributionTotal > 0 && active
      ? (state.dividends * active.contribution) / contributionTotal
      : 0;
  const nameOf = (id: string) => memberLabel(lang, memberById(state, id)?.name ?? id);
  const kickTip = (ok: boolean): string => {
    if (readOnly) return t(lang, "companyPage.readOnlyAction");
    return ok ? t(lang, "contrib.tipKicked") : t(lang, "contrib.tipDefault");
  };

  return (
    <>
      {!readOnly && (
        <p style={{ fontSize: 10, color: "#666", margin: "2px 0 0" }}>
          {t(lang, "companyPage.switchHint")}
        </p>
      )}
      {state.members.map((m) => {
        const inOrg = crew.includes(m.id);
        const wallet = state.wallets[m.id] ?? 0;
        const kickable = inOrg && canBeKicked(state, m.id) && !readOnly;
        const isActive = state.activeId === m.id;
        const canSwitch = inOrg && !readOnly;
        return (
          <div
            key={m.id}
            onClick={canSwitch ? () => dispatch({ type: "switch", memberId: m.id }) : undefined}
            style={{
              ...panel,
              marginTop: 8,
              padding: 12,
              opacity: inOrg ? 1 : 0.55,
              borderColor: isActive ? "#76b900" : "#2a2a2a",
              cursor: canSwitch ? "pointer" : "default",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: "bold", fontSize: 13 }}>
                <IconUser size={12} /> {nameOf(m.id)}
              </span>
              {!inOrg && <span style={badge}>{t(lang, "member.out")}</span>}
              <span style={{ ...badge, color: "#76b900", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <IconBanknote size={10} />
                {t(lang, "companyPage.asset", { usd: wallet.toFixed(2) })}
              </span>
              <span style={{ fontSize: 11, color: "#888" }}>
                {t(lang, "member.contrib", { n: m.contribution })}
                {inOrg &&
                  contributionTotal > 0 &&
                  t(lang, "member.share", {
                    pct: Math.round((m.contribution / contributionTotal) * 100),
                  })}
              </span>
              <div
                style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 罢免：视觉弱化的 ghost 按钮 */}
                {inOrg && (
                  <button
                    disabled={!kickable}
                    onClick={() => dispatch({ type: "kick", targetId: m.id })}
                    title={kickTip(kickable)}
                    style={{
                      background: "transparent",
                      color: kickable ? "#c66" : "#4a4a4a",
                      border: `1px solid ${kickable ? "#633" : "#333"}`,
                      borderRadius: 6,
                      cursor: kickable ? "pointer" : "not-allowed",
                      fontSize: 10,
                      padding: "2px 8px",
                    }}
                  >
                    {t(lang, "contrib.kick")}
                  </button>
                )}
                {/* 归队：补缴市值 1/3 */}
                {!inOrg && (
                  <button
                    disabled={readOnly || wallet < rejoinFee || !!state.proposal}
                    onClick={() => dispatch({ type: "recruit", memberId: m.id })}
                    title={readOnly ? t(lang, "companyPage.readOnlyAction") : undefined}
                    style={{
                      ...voteBtn(
                        !readOnly && wallet >= rejoinFee ? "#76b900" : "#333",
                        !readOnly && wallet >= rejoinFee ? "#000" : "#666",
                      ),
                      fontSize: 11,
                      padding: "4px 10px",
                    }}
                  >
                    {t(lang, "staff.recall", { m: nameOf(m.id), cost: rejoinFee.toFixed(2) })}
                  </button>
                )}
              </div>
            </div>
            <div style={{ maxWidth: 280, marginTop: 4 }}>
              <RepBars rep={m.rep} lang={lang} height={40} />
            </div>
          </div>
        );
      })}

      {/* 辞职：保留但视觉不突出（公开页只读，不渲染） */}
      {!readOnly && crew.includes(state.activeId) && !state.proposal && (
        <button
          onClick={() => dispatch({ type: "quit" })}
          style={{
            background: "transparent",
            color: "#8a7272",
            border: "1px solid #332929",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 11,
            padding: "5px 12px",
            marginTop: 12,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <IconDoorOpen size={12} />
          {t(lang, "quit.btn", { div: myDividend.toFixed(2) })}
        </button>
      )}
    </>
  );
}

/** 表决面板：扩产 / 罢免 / 公司命名 / 全称修改四类共用（readOnly 时只读表与票数） */
function ProposalPanel({ readOnly }: { readOnly: boolean }) {
  const { state, dispatch, lang } = useGame();
  const proposal = state.proposal;
  if (!proposal) return null;

  const crew = activeMembers(state);
  const kickTarget = kickTargetId(proposal) ?? "";
  const nameOf = (id: string) => memberLabel(lang, memberById(state, id)?.name ?? id);
  const waitingToVote =
    proposal.phase === "voting"
      ? crew.filter((id) => !(id in (proposal.ballots || {})) && id !== kickTarget)
      : [];
  const nextVoter = waitingToVote[0];
  // 阈值随在册人数封顶：3 人公司 2 票，1 人公司 1 票
  const need = passVotesFor(state);

  /**
   * 标题与副行按 kind 分支（四种类型的展示文案集中在这里）：
   * expand 扩产 / kick 罢免 / naming 公司命名 / fullName 全称修改。
   */
  let title: string;
  let detail = "";
  if (kickTarget) {
    title = t(lang, "vote.titleKick", { m: nameOf(kickTarget) });
  } else if (proposal.kind === "naming") {
    title = t(lang, "vote.titleNaming", { name: proposal.name });
    detail = t(lang, "vote.namingDetail", {
      name: proposal.name,
      full: proposal.fullName ?? proposal.name,
    });
  } else if (proposal.kind === "fullName") {
    title = t(lang, "vote.titleFullName", { name: proposal.fullName });
    detail = t(lang, "vote.fullNameDetail", { name: proposal.fullName });
  } else {
    const gpu = gpuById(expandGpuId(proposal) ?? "");
    title = t(lang, "vote.titleExpand", {
      gpu: gpu?.name ?? expandGpuId(proposal) ?? "",
      cost: gpu?.cost.toLocaleString() ?? "",
    });
  }

  return (
    <div style={{ ...panel, borderColor: "#76b900" }}>
      <div style={{ fontWeight: "bold", marginBottom: 8 }}>
        {title}
        <span style={{ ...badge, marginLeft: 8 }}>
          {t(lang, "vote.by", { m: nameOf(proposal.proposerId) })}
        </span>
      </div>
      {detail && (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 6 }}>{detail}</div>
      )}
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        {t(lang, "vote.tally", {
          yes: proposal.yes,
          no: proposal.no,
          need,
        })}
        {proposal.phase === "voting" && nextVoter && (
          <span style={{ color: "#fa0" }}>{t(lang, "vote.waiting", { m: nameOf(nextVoter) })}</span>
        )}
      </div>
      {proposal.phase === "voting" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={voteBtn("#76b900", "#000")}
            disabled={readOnly || !nextVoter}
            title={readOnly ? t(lang, "companyPage.readOnlyAction") : undefined}
            onClick={() => nextVoter && dispatch({ type: "ballot", memberId: nextVoter, yes: true })}
          >
            {t(lang, "vote.yes")}
          </button>
          <button
            style={voteBtn("#a33", "#fff")}
            disabled={readOnly || !nextVoter}
            title={readOnly ? t(lang, "companyPage.readOnlyAction") : undefined}
            onClick={() => nextVoter && dispatch({ type: "ballot", memberId: nextVoter, yes: false })}
          >
            {t(lang, "vote.no")}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontWeight: "bold",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: phaseColor(proposal.phase),
            }}
          >
            <PhaseIcon phase={proposal.phase} />
            {t(lang, phaseLabelKey(proposal.phase))}
          </span>
          <button
            style={voteBtn("#333", "#ccc")}
            disabled={readOnly}
            title={readOnly ? t(lang, "companyPage.readOnlyAction") : undefined}
            onClick={() => dispatch({ type: "close" })}
          >
            {t(lang, "vote.close")}
          </button>
        </div>
      )}
    </div>
  );
}

/** GPU 世代 · 扩产（表决面板 + 19 款列表，两页共用） */
export function GpuGenerations({ readOnly = false }: { readOnly?: boolean }) {
  const { state, dispatch, lang } = useGame();
  const crew = activeMembers(state);
  const active = memberById(state, state.activeId);
  const nameOf = (id: string) => memberLabel(lang, memberById(state, id)?.name ?? id);

  return (
    <>
      <ProposalPanel readOnly={readOnly} />
      <div style={{ maxHeight: 460, overflowY: "auto" }}>
        {GPUS.map((gpu) => {
          const count = state.owned[gpu.id] || 0;
          const lackHash = state.hash < gpu.cost;
          const canPropose =
            !readOnly &&
            !state.proposal &&
            !!active &&
            crew.includes(state.activeId) &&
            !lackHash;
          const chance = active ? successChance(gpu, linkedComposite(state, active.rep)) : 0;
          return (
            <div
              key={gpu.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid #262626",
              }}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: 13 }}>
                  {t(lang, "gpu.line1", { name: gpu.name, year: gpu.year })}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {t(lang, "gpu.line2", {
                    h: gpu.baseHashrate,
                    y: (gpu.baseHashrate * YIELD_PER_HASH * 100).toFixed(2),
                    n: count,
                  })}{" "}
                  <span style={{ color: chance >= 0.8 ? "#76b900" : chance >= 0.6 ? "#fa0" : "#f55" }}>
                    {Math.round(chance * 100)}%
                  </span>{" "}
                  {t(lang, "gpu.by", {
                    m: active ? nameOf(active.id) : "?",
                    c: active ? Math.round(compositeRep(active.rep)) : "-",
                    b: Math.round(
                      linkedComposite(state, active?.rep ?? { dev: 50, factory: 50, media: 50, ai: 50 }),
                    ),
                  })}
                  {lackHash && (
                    <span style={{ color: "#f55" }}>
                      {t(lang, "gpu.lack", { n: Math.ceil(gpu.cost - state.hash).toLocaleString() })}
                    </span>
                  )}
                </div>
              </div>
              <button
                disabled={!canPropose}
                title={readOnly ? t(lang, "companyPage.readOnlyAction") : undefined}
                onClick={() => dispatch({ type: "propose", gpuId: gpu.id })}
                style={{
                  padding: "7px 12px",
                  background: canPropose ? "#76b900" : "#333",
                  color: canPropose ? "#000" : "#666",
                  border: "none",
                  borderRadius: 8,
                  cursor: canPropose ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <IconPickaxe size={11} />
                {t(lang, "gpu.propose", { cost: gpu.cost.toLocaleString() })}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
