"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  INCORPORATION_FEE,
  YIELD_PER_HASH,
  HASH_PASSIVE_SCALE,
  DEFAULT_COMPANY_NAME,
  RESERVED_SLUGS,
  slugFromName,
  marketCap,
  annualYield,
  usdPerSec,
  hashPerSec,
  activeMembers,
  balanceParts,
  buildUsdBoard,
  buildHashBoard,
  memberById,
  type RankRow,
} from "../lib/game";
import { t, memberLabel } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import { RepBars } from "../components/rep-bars";
import { LogFeed } from "../components/log-feed";
import { panel, badge, voteBtn, iconBtn } from "../components/ui";
import { PageBody, SectionTitle } from "../components/shell";
import {
  IconHeartHandshake,
  IconShoppingCart,
  IconUser,
  IconPickaxe,
  IconAlertTriangle,
  IconBanknote,
  IconGlobe,
  IconTrophy,
  IconGlasses,
  IconBuilding,
} from "../components/icons";

export default function HomePage() {
  const { state, dispatch, lang, flash, pulse } = useGame();
  const [nameInput, setNameInput] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [copied, setCopied] = useState(false);

  const orgMembers = state.org?.members ?? [];
  const crew = activeMembers(state);
  const active = memberById(state, state.activeId);
  const inOrg = (id: string) => orgMembers.includes(id) && id !== "";
  const mcap = marketCap(state);
  const companyName = state.org?.name ?? "";
  const needsNaming = !!state.org && companyName === DEFAULT_COMPANY_NAME;
  const named = !!state.org && companyName !== DEFAULT_COMPANY_NAME;
  const slug = state.org ? slugFromName(state.org.name) : "";
  const usdBoard = buildUsdBoard(state);
  const hashBoard = buildHashBoard(state);
  const parts = balanceParts(state.usd);
  const nameOf = (id: string) => memberLabel(lang, memberById(state, id)?.name ?? id);
  const myWallet = active ? state.wallets[active.id] ?? 0 : 0;
  const myWalletParts = balanceParts(myWallet);
  const yieldNow = annualYield(state);

  const mine = useCallback(() => {
    dispatch({ type: "mine" });
    pulse();
  }, [dispatch, pulse]);

  const checkName = (): string | null => {
    const name = nameInput.trim();
    if (!name) {
      setNameErr(t(lang, "header.errEmpty"));
      return null;
    }
    if (!/^[A-Za-z0-9]{1,20}$/.test(name)) {
      setNameErr(t(lang, "header.errChars"));
      return null;
    }
    if (RESERVED_SLUGS.has(slugFromName(name))) {
      setNameErr(t(lang, "header.errReserved"));
      return null;
    }
    setNameErr("");
    return name;
  };

  const submitFound = () => {
    const name = checkName();
    if (!name) return;
    dispatch({ type: "found", name });
    setNameInput("");
  };

  const submitRename = () => {
    const name = checkName();
    if (!name) return;
    dispatch({ type: "rename", name });
    setNameInput("");
  };

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard 不可用时忽略
    }
  };

  return (
    <PageBody>
      {/* 命名面板 */}
      {(needsNaming || !state.org) && (
        <div style={{ ...panel, marginTop: 12, borderColor: "#76b900" }}>
          <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>
            {t(lang, state.org ? "header.nameOnce" : "header.nameNew")}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (nameErr) setNameErr("");
              }}
              placeholder={t(lang, "header.placeholder")}
              maxLength={20}
              style={{
                flex: 1,
                padding: "8px 10px",
                background: "#0d0d0d",
                border: nameErr ? "1px solid #f55" : "1px solid #333",
                borderRadius: 8,
                color: "#e0e0e0",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={state.org ? submitRename : submitFound}
              disabled={
                !nameInput.trim() ||
                !!state.proposal ||
                (!state.org && state.usd < INCORPORATION_FEE)
              }
              style={voteBtn("#76b900", "#000")}
            >
              {state.org
                ? t(lang, "header.renameBtn")
                : t(lang, "header.foundBtn", { fee: INCORPORATION_FEE })}
            </button>
          </div>
          {nameErr ? (
            <div style={{ fontSize: 11, color: "#f55", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <IconAlertTriangle size={12} /> {nameErr}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>{t(lang, "header.nameOk")}</div>
          )}
        </div>
      )}

      {/* ============ 个人区 ============ */}
      <SectionTitle icon={<IconUser size={13} />} text={t(lang, "section.personal")} />
      <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "stretch", flexWrap: "wrap" }}>
        <a
          href="/shop"
          style={{
            flex: "1 1 150px",
            minWidth: 150,
            ...panel,
            marginTop: 0,
            border: "2px solid #f2f2f2",
            background: "#1a1a1a",
            textDecoration: "none",
          }}
        >
          <div style={{ fontSize: 11, color: "#bbb", display: "flex", alignItems: "center", gap: 5 }}>
            <IconUser size={11} /> {active ? nameOf(active.id) : "-"}
          </div>
          <div style={{ fontWeight: "bold", color: "#f2f2f2", marginTop: 6, fontSize: 17, display: "flex", alignItems: "baseline", gap: 4 }}>
            <IconBanknote size={14} /> {myWalletParts.whole}
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 2, opacity: 0.8 }}>{myWalletParts.pusd}</div>
          <div style={{ fontSize: 10, color: "#777", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <IconShoppingCart size={10} /> {t(lang, "wallet.enterShop")}
          </div>
        </a>
        {active && (
          <div style={{ flex: "1 1 220px", minWidth: 200, ...panel, marginTop: 0 }}>
            <RepBars rep={active.rep} lang={lang} height={60} />
          </div>
        )}
      </div>

      {/* 公司区：USD 余额 + HASH 余额 + 双榜 */}
      <SectionTitle icon={<IconBuilding size={13} />} text={t(lang, "section.company")} />

      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        {/* 公司 USD 余额 */}
        <div
          style={{
            flex: "1 1 220px",
            ...panel,
            marginTop: 0,
            textAlign: "center",
            background: "#1a1a1a",
            borderColor: "#76b900",
          }}
        >
          <div style={{ fontSize: 11, color: "#888" }}>{t(lang, "rank.usdTitle")}</div>
          <div style={{ fontWeight: "bold", color: "#76b900", marginTop: 6, display: "flex", alignItems: "baseline", justifyContent: "center", gap: 5, flexWrap: "wrap" }}>
            <IconBanknote size={20} />
            <span style={{ fontSize: 24 }}>{parts.whole}</span>{" "}
            <span style={{ fontSize: 13, opacity: 0.75 }}>{parts.pusd}</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 6, color: "#999" }}>
            {t(lang, "card.live", { rate: usdPerSec(state).toFixed(9) })} · {(yieldNow * 100).toFixed(2)}%
          </div>
          <div style={{ fontSize: 11, color: "#76b900", marginTop: 4 }}>
            #{usdBoard.myRank} / {usdBoard.rows.length}
          </div>
        </div>

        {/* HASH 余额：点击挖矿 + 捐赠入口 */}
        <div
          style={{
            flex: "1 1 220px",
            position: "relative",
            ...panel,
            marginTop: 0,
            textAlign: "center",
            background: flash ? "#76b900" : "#1a1a1a",
            color: flash ? "#000" : "#76b900",
            cursor: inOrg(state.activeId) ? "pointer" : "not-allowed",
            userSelect: "none",
            transition: "background 0.1s",
          }}
          onClick={inOrg(state.activeId) ? mine : undefined}
        >
          <a
            href="/donate"
            title={t(lang, "donate.title")}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", right: 8, top: 8, ...iconBtn(flash ? "#76b900" : "#1c2418", flash ? "#000" : "#76b900", 32), textDecoration: "none", border: "1px solid #3a3a3a" }}
          >
            <IconHeartHandshake size={17} />
          </a>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{t(lang, "rank.hashTitle")}</div>
          <div style={{ fontWeight: "bold", marginTop: 6, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <IconPickaxe size={19} />
            {Math.floor(state.hash).toLocaleString()}
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
            {t(lang, "hash.passive", { rate: hashPerSec(state).toFixed(3) })}
          </div>
          <div style={{ fontSize: 11, marginTop: 4 }}>
            #{hashBoard.myRank} / {hashBoard.rows.length}
          </div>
        </div>
      </div>

      {/* 公司经营入口 */}
      {named && (
        <div style={{ ...panel, marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#888", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <IconGlobe size={12} /> {t(lang, "home.addr")}
          </span>
          <code style={{ fontSize: 12, color: "#8ab4f8", fontFamily: "monospace" }}>
            {typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5790"}/{slug}
          </code>
          <button
            onClick={copyAddr}
            style={{ ...badge, cursor: "pointer", background: "#101010", color: copied ? "#76b900" : "#999" }}
          >
            {copied ? `✓ ${t(lang, "home.copied")}` : t(lang, "home.copy")}
          </button>
          <Link
            href={`/${slug}`}
            style={{ ...badge, color: "#76b900", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginLeft: "auto" }}
          >
            <IconGlasses size={11} /> {t(lang, "nav.company")} · {t(lang, "companyPage.title")}
          </Link>
        </div>
      )}

      {/* ============ 双榜：单卡双 tab ============ */}
      <SectionTitle icon={<IconTrophy size={13} />} text={t(lang, "rank.title")} />
      <div style={{ display: "flex", marginTop: 8 }}>
        <BoardTabs usdRows={usdBoard.rows} hashRows={hashBoard.rows} />
      </div>

      {crew.length < 3 && state.org && (
        <Link
          href={`/${slug}`}
          style={{ display: "flex", ...panel, marginTop: 10, borderColor: "#fa0", textDecoration: "none", alignItems: "center", gap: 8 }}
        >
          <span style={{ fontSize: 12, color: "#fa0", fontWeight: "bold" }}>
            {t(lang, "staff.short", { name: companyName, n: crew.length, size: 3 })}
          </span>
          <span style={{ fontSize: 11, color: "#76b900", marginLeft: "auto" }}>{t(lang, "staff.goCompany")}</span>
        </Link>
      )}

      <LogFeed state={state} lang={lang} />
    </PageBody>
  );
}

/** USD 榜数值列：市值取整加 $ 前缀 */
function pickUsd(r: RankRow): string {
  return `$${Math.round(r.mcap).toLocaleString()}`;
}

/** HASH 榜数值列：HASH 取整 */
function pickHash(r: RankRow): string {
  return Math.round(r.hash).toLocaleString();
}

/** 榜单表格（渲染 helper）：名次 / 公司名 / 你标记 / 已解散 / 右侧数值 */
function BoardTable({ rows, pick }: { rows: RankRow[]; pick: (r: RankRow) => string }) {
  const { lang } = useGame();
  return (
    // 固定 minHeight：USD / HASH 两榜切换时不抖高度
    <div style={{ minHeight: 168 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {rows.slice(0, 6).map((r, i) => (
            <tr
              key={r.name + i}
              style={{
                borderTop: "1px solid #1e1e1e",
                color: r.self ? "#76b900" : "#aaa",
                background: r.self ? "#16210f" : "transparent",
              }}
            >
              <td style={{ padding: "4px 8px", width: 22 }}>{i + 1}</td>
              <td style={{ padding: "4px 4px" }}>
                {r.dissolved ? t(lang, "rank.dissolved") : r.name}
                {r.self && (
                  <span style={{ ...badge, marginLeft: 5, color: "#76b900", fontSize: 9 }}>{t(lang, "rank.you")}</span>
                )}
              </td>
              <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>
                {pick(r)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 世界排名单卡：USD 榜 / HASH 榜 双 tab（默认 USD） */
function BoardTabs({ usdRows, hashRows }: { usdRows: RankRow[]; hashRows: RankRow[] }) {
  const { lang } = useGame();
  const [tab, setTab] = useState<"usd" | "hash">("usd");
  const rows = tab === "usd" ? usdRows : hashRows;
  const pick = tab === "usd" ? pickUsd : pickHash;
  const tabs: { key: "usd" | "hash"; label: string }[] = [
    { key: "usd", label: t(lang, "rank.tabUsd") },
    { key: "hash", label: t(lang, "rank.tabHash") },
  ];
  return (
    <div style={{ flex: "1 1 100%", ...panel, marginTop: 0 }}>
      <div role="tablist" aria-label={t(lang, "rank.title")} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              ...voteBtn(tab === tb.key ? "#76b900" : "#222", tab === tb.key ? "#000" : "#999"),
              fontSize: 11,
              padding: "4px 12px",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <BoardTable rows={rows} pick={pick} />
      <p style={{ fontSize: 9, color: "#555", margin: "6px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
        <IconAlertTriangle size={9} /> {t(lang, "rank.note")}
      </p>
    </div>
  );
}
