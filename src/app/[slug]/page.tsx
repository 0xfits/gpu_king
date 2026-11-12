"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  GPUS,
  PASS_VOTES,
  YIELD_PER_HASH,
  activeMembers,
  canBeKicked,
  memberById,
  marketCap,
  rejoinCost,
  slugFromName,
  companyComposite,
  balanceParts,
  annualYield,
  successChance,
  linkedComposite,
  compositeRep,
  gpuById,
  REJOIN_DIVISOR,
} from "../../lib/game";
import { t, memberLabel } from "../../lib/i18n";
import { useGame } from "../../lib/game-context";
import { RepBars } from "../../components/rep-bars";
import { LogFeed } from "../../components/log-feed";
import { panel, badge, voteBtn, iconBtn } from "../../components/ui";
import { PageBody, SectionTitle } from "../../components/shell";
import {
  IconBuilding,
  IconUser,
  IconBanknote,
  IconDoorOpen,
  IconGlobe,
  IconMegaphone,
  IconGlasses,
  IconPickaxe,
  IconCheckCircle,
  IconXCircle,
  IconAlertTriangle,
} from "../../components/icons";

export default function CompanyPage() {
  const { state, dispatch, lang } = useGame();
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params?.slug ?? "");
  const [copied, setCopied] = useState(false);

  const org = state.org;
  const selfSlug = org ? slugFromName(org.name) : "";
  const isMine = !!org && selfSlug === slug;

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard 不可用时忽略
    }
  };

  if (!isMine) {
    return (
      <PageBody>
        <div style={{ ...panel, borderColor: "#555", textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <IconGlobe size={14} /> {t(lang, "companyPage.notFound")}
          </div>
          <p style={{ fontSize: 11, color: "#666", margin: "8px 0 0" }}>
            {t(lang, "companyPage.notFoundHint", { url: `/${org ? selfSlug : ":name"}` })}
          </p>
        </div>
      </PageBody>
    );
  }

  const nameOf = (id: string) => memberLabel(lang, memberById(state, id)?.name ?? id);
  const crew = activeMembers(state);
  const contributionTotal = crew.reduce(
    (s, id) => s + (memberById(state, id)?.contribution ?? 0),
    0,
  );
  const rejoinFee = rejoinCost(state);
  const mcap = marketCap(state);
  const parts = balanceParts(state.usd);
  const active = memberById(state, state.activeId);
  const myDividend =
    contributionTotal > 0 && active
      ? (state.dividends * active.contribution) / contributionTotal
      : 0;
  const waitingToVote =
    state.proposal?.phase === "voting"
      ? crew.filter(
          (id) =>
            !(id in (state.proposal!.ballots || {})) &&
            id !== (state.proposal!.gpuId.startsWith("kick:") ? state.proposal!.gpuId.slice(5) : ""),
        )
      : [];
  const nextVoter = waitingToVote[0];
  const proposalGpu =
    state.proposal && !state.proposal.gpuId.startsWith("kick:")
      ? gpuById(state.proposal.gpuId)
      : undefined;

  return (
    <PageBody>
      {/* 公司头 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ ...iconBtn("#1c2418", "#76b900", 34) }}>
          <IconBuilding size={18} />
        </span>
        <h2 style={{ color: "#76b900", margin: 0, fontSize: 18 }}>{t(lang, "companyPage.title")}</h2>
        <span style={{ fontSize: 15, color: "#e0e0e0" }}>「{org!.name}」</span>
        <button
          onClick={copyAddr}
          title={`/${slug}`}
          style={{
            ...badge,
            cursor: "pointer",
            background: "#101010",
            color: copied ? "#76b900" : "#8ab4f8",
            fontFamily: "monospace",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <IconGlobe size={11} /> /{slug}
          {copied ? ` ✓ ${t(lang, "home.copied")}` : ""}
        </button>
      </div>

      {/* 公司账户 */}
      <div style={{ ...panel, marginTop: 10, textAlign: "center", background: "#1a1a1a", borderColor: "#76b900" }}>
        <div style={{ fontWeight: "bold", color: "#76b900", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
          <IconBanknote size={20} />
          <span style={{ fontSize: 24 }}>{parts.whole}</span>{" "}
          <span style={{ fontSize: 13, opacity: 0.75 }}>{parts.pusd}</span>
        </div>
        <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
          {t(lang, "card.mcap", { mcap: mcap.toFixed(2), div: REJOIN_DIVISOR })} · APY{" "}
          {(annualYield(state) * 100).toFixed(2)}%
        </div>
      </div>

      {/* 公司声望 */}
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

      {/* 三位股东 */}
      <SectionTitle icon={<IconUser size={13} />} text={t(lang, "companyPage.shareholders")} />
      <p style={{ fontSize: 10, color: "#666", margin: "2px 0 0" }}>{t(lang, "companyPage.switchHint")}</p>
      {state.members.map((m) => {
        const inOrg = crew.includes(m.id);
        const wallet = state.wallets[m.id] ?? 0;
        const kickable = inOrg && canBeKicked(state, m.id);
        const isActive = state.activeId === m.id;
        return (
          <div
            key={m.id}
            onClick={inOrg ? () => dispatch({ type: "switch", memberId: m.id }) : undefined}
            style={{
              ...panel,
              marginTop: 8,
              padding: 12,
              opacity: inOrg ? 1 : 0.55,
              borderColor: isActive ? "#76b900" : "#2a2a2a",
              cursor: inOrg ? "pointer" : "default",
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
                {inOrg && contributionTotal > 0 &&
                  t(lang, "member.share", { pct: Math.round((m.contribution / contributionTotal) * 100) })}
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
                    title={kickable ? t(lang, "contrib.tipKicked") : t(lang, "contrib.tipDefault")}
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
                    disabled={wallet < rejoinFee || !!state.proposal}
                    onClick={() => dispatch({ type: "recruit", memberId: m.id })}
                    style={{
                      ...voteBtn(wallet >= rejoinFee ? "#76b900" : "#333", wallet >= rejoinFee ? "#000" : "#666"),
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

      {/* 辞职：保留但视觉不突出 */}
      {crew.includes(state.activeId) && !state.proposal && (
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

      {/* 表决面板（自首页移交） */}
      {state.proposal && (
        <div style={{ ...panel, borderColor: "#76b900" }}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>
            {state.proposal.gpuId.startsWith("kick:")
              ? t(lang, "vote.titleKick", { m: nameOf(state.proposal.gpuId.slice(5)) })
              : t(lang, "vote.titleExpand", {
                  gpu: proposalGpu?.name ?? state.proposal.gpuId,
                  cost: proposalGpu?.cost.toLocaleString() ?? "",
                })}
            <span style={{ ...badge, marginLeft: 8 }}>
              {t(lang, "vote.by", { m: nameOf(state.proposal.proposerId) })}
            </span>
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {t(lang, "vote.tally", { yes: state.proposal.yes, no: state.proposal.no, need: PASS_VOTES })}
            {state.proposal.phase === "voting" && nextVoter && (
              <span style={{ color: "#fa0" }}>{t(lang, "vote.waiting", { m: nameOf(nextVoter) })}</span>
            )}
          </div>
          {state.proposal.phase === "voting" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={voteBtn("#76b900", "#000")}
                disabled={!nextVoter}
                onClick={() =>
                  nextVoter && dispatch({ type: "ballot", memberId: nextVoter, yes: true })
                }
              >
                {t(lang, "vote.yes")}
              </button>
              <button
                style={voteBtn("#a33", "#fff")}
                disabled={!nextVoter}
                onClick={() =>
                  nextVoter && dispatch({ type: "ballot", memberId: nextVoter, yes: false })
                }
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
                  color:
                    state.proposal.phase === "passed"
                      ? "#76b900"
                      : state.proposal.phase === "failed"
                        ? "#f55"
                        : "#fa0",
                }}
              >
                {state.proposal.phase === "passed" ? (
                  <IconCheckCircle size={16} />
                ) : state.proposal.phase === "failed" ? (
                  <IconXCircle size={16} />
                ) : (
                  <IconAlertTriangle size={16} />
                )}
                {t(
                  lang,
                  state.proposal.phase === "passed"
                    ? "vote.passed"
                    : state.proposal.phase === "failed"
                      ? "vote.failed"
                      : "vote.rejected",
                )}
              </span>
              <button style={voteBtn("#333", "#ccc")} onClick={() => dispatch({ type: "close" })}>
                {t(lang, "vote.close")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* GPU 投产面板（自首页移交） */}
      <SectionTitle icon={<IconPickaxe size={13} />} text={t(lang, "gpu.title")} />
      <div style={{ maxHeight: 460, overflowY: "auto" }}>
        {GPUS.map((gpu) => {
          const count = state.owned[gpu.id] || 0;
          const lackHash = state.hash < gpu.cost;
          const canPropose =
            !state.proposal && !!active && crew.includes(state.activeId) && !lackHash;
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
                    b: Math.round(linkedComposite(state, active?.rep ?? { dev: 50, factory: 50, media: 50, ai: 50 })),
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

      <LogFeed state={state} lang={lang} />
    </PageBody>
  );
}
