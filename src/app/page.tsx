"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  INCORPORATION_FEE,
  DEFAULT_COMPANY_NAME,
  RESERVED_SLUGS,
  slugFromName,
  isValidCompanyName,
  isValidCompanyFullName,
  companyDisplayName,
  COMPANY_NAME_MAX,
  COMPANY_FULLNAME_MAX,
  annualYield,
  usdPerSec,
  hashPerSec,
  balanceParts,
  buildUsdBoard,
  buildHashBoard,
  memberById,
  passVotesFor,
} from "../lib/game";
import { t, memberLabel } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import { RepBars } from "../components/rep-bars";
import { LogFeed } from "../components/log-feed";
import { CompanyRepPanel, GpuGenerations, Shareholders } from "../components/company-sections";
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
  IconGlasses,
  IconBuilding,
} from "../components/icons";

/**
 * Co 页（公司中心页，路由 /）板块顺序固定：
 * 命名 → 个人账户与声望 → 公司余额 → GPU 世代 → 股东 → 公司详情 → 公司动态
 * GPU / 股东两块与 /<slug> 公开页共用 company-sections.tsx。
 * 全网公司排名已迁至 /public（共用 components/leaderboard.tsx）。
 */
export default function CoPage() {
  const { state, dispatch, lang, flash, pulse } = useGame();
  const [nameInput, setNameInput] = useState("");
  const [fullInput, setFullInput] = useState("");
  const [copied, setCopied] = useState(false);
  /** 公司详情里的「修改全称」内联编辑器 */
  const [editingFull, setEditingFull] = useState(false);
  const [fullNameDraft, setFullNameDraft] = useState("");

  const orgMembers = state.org?.members ?? [];
  const active = memberById(state, state.activeId);
  const inOrg = (id: string) => orgMembers.includes(id) && id !== "";
  const companyName = state.org?.name ?? "";
  const needsNaming = !!state.org && companyName === DEFAULT_COMPANY_NAME;
  const named = !!state.org && companyName !== DEFAULT_COMPANY_NAME;
  const namingProposal =
    state.proposal && state.proposal.kind === "naming" ? state.proposal : null;
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

  // 实时校验：输入即时算错误，不再等提交（空输入不报错，只禁用按钮）
  const nameProblem = (raw: string): string => {
    const s = raw.trim();
    if (!s) return "";
    if (isValidCompanyName(s)) return "";
    return RESERVED_SLUGS.has(slugFromName(s))
      ? t(lang, "header.errReserved")
      : t(lang, "header.errChars");
  };
  const fullProblem = (raw: string): string => {
    const s = raw.trim();
    if (!s || isValidCompanyFullName(s)) return "";
    return t(lang, "header.errFullName");
  };
  const nameErr = nameProblem(nameInput);
  const fullErr = fullProblem(fullInput);
  const trimmedName = nameInput.trim();
  const canName =
    !!trimmedName &&
    !nameErr &&
    !fullErr &&
    !state.proposal &&
    (!!state.org || state.usd >= INCORPORATION_FEE);

  const submitName = () => {
    if (!canName) return;
    const name = trimmedName;
    const fullName = fullInput.trim() || undefined;
    // 命名改为提案制：found 现在只创建 kind:"naming" 表决，通过后简称才生效并永久锁定
    // （无公司时同一 action 还会先出资+缴注册费，公司以默认名落地后再表决命名）
    dispatch({ type: "found", name, fullName });
    setNameInput("");
    setFullInput("");
  };

  const displayName = companyDisplayName(state.org);

  // —— 全称修改（可反复发起，走 fullName 表决；简称与 slug 不变）——
  const draftFull = fullNameDraft.trim();
  const draftFullErr = fullProblem(fullNameDraft);
  const canProposeFullName = !!draftFull && !draftFullErr && !state.proposal;
  const submitFullName = () => {
    if (!canProposeFullName) return;
    dispatch({ type: "proposeFullName", fullName: draftFull });
    setEditingFull(false);
    setFullNameDraft("");
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
      {/* ============ 1) 命名面板（提名 → 股东表决；通过后简称永久锁死） ============ */}
      {(needsNaming || !state.org) &&
        (namingProposal ? (
          // 已有命名提案：面板只读展示进度（投票在下方 GPU 世代的表决面板里进行）
          <div style={{ ...panel, marginTop: 12, borderColor: "#fa0" }}>
            <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>
              {t(lang, "header.namingPending")}
            </div>
            <div style={{ fontSize: 13 }}>
              {t(lang, "vote.titleNaming", { name: namingProposal.name })}
            </div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              {t(lang, "vote.namingDetail", {
                name: namingProposal.name,
                full: namingProposal.fullName ?? namingProposal.name,
              })}
            </div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {t(lang, "vote.tally", {
                yes: namingProposal.yes,
                no: namingProposal.no,
                need: passVotesFor(state),
              })}
            </div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>
              {t(lang, "header.nominateHint")}
            </div>
          </div>
        ) : (
          <div style={{ ...panel, marginTop: 12, borderColor: "#76b900" }}>
            <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 6 }}>
              {t(lang, state.org ? "header.nameOnce" : "header.nameNew")}
            </div>
            {/* 简称：字母在前、数字在后，1~6 位，决定 slug */}
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{t(lang, "header.nameLabel")}</div>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t(lang, "header.placeholder")}
              maxLength={COMPANY_NAME_MAX}
              aria-label={t(lang, "header.nameLabel")}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 4,
                padding: "8px 10px",
                background: "#0d0d0d",
                border: nameErr ? "1px solid #f55" : "1px solid #333",
                borderRadius: 8,
                color: "#e0e0e0",
                fontSize: 13,
                outline: "none",
              }}
            />
            {/* 全称：可选，仅展示用，不影响 slug */}
            <div style={{ fontSize: 10, color: "#888", marginTop: 8 }}>{t(lang, "header.fullName")}</div>
            <input
              value={fullInput}
              onChange={(e) => setFullInput(e.target.value)}
              placeholder={t(lang, "header.fullNamePlaceholder")}
              maxLength={COMPANY_FULLNAME_MAX}
              aria-label={t(lang, "header.fullName")}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginTop: 4,
                padding: "8px 10px",
                background: "#0d0d0d",
                border: fullErr ? "1px solid #f55" : "1px solid #333",
                borderRadius: 8,
                color: "#e0e0e0",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={submitName}
              disabled={!canName}
              style={{ ...voteBtn("#76b900", "#000"), width: "100%", marginTop: 8, opacity: canName ? 1 : 0.55 }}
            >
              {state.org
                ? t(lang, "header.nominateBtn")
                : t(lang, "header.foundBtn", { fee: INCORPORATION_FEE })}
            </button>
            {nameErr || fullErr ? (
              <div style={{ fontSize: 11, color: "#f55", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <IconAlertTriangle size={12} /> {nameErr || fullErr}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>{t(lang, "header.nameOk")}</div>
            )}
            <div style={{ fontSize: 10, color: "#8a8a5a", marginTop: 6 }}>
              {t(lang, "header.nominateHint")}
            </div>
          </div>
        ))}

      {/* ============ 2) 个人账户与声望 ============ */}
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

      {/* ============ 3) 公司余额 ============ */}
      <SectionTitle icon={<IconBuilding size={13} />} text={t(lang, "section.companyBalance")} />
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

        {/* HASH 余额：点击挖矿 + 公开捐赠入口 */}
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
            href="/public"
            title={t(lang, "public.title")}
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
        {/* Inject / Withdraw 按钮下一批加（需提案投票） */}
      </div>

      {/* 公司声望 · 品牌 */}
      <CompanyRepPanel />

      {/* ============ 4) GPU 世代（经营） ============ */}
      <SectionTitle icon={<IconPickaxe size={13} />} text={t(lang, "section.gpuGenerations")} />
      <GpuGenerations />

      {/* ============ 5) 股东 ============ */}
      <SectionTitle icon={<IconUser size={13} />} text={t(lang, "section.shareholders")} />
      <Shareholders />

      {/* ============ 6) 公司详情 ============ */}
      <SectionTitle icon={<IconGlobe size={13} />} text={t(lang, "section.companyDetail")} />
      {named ? (
        <>
          <div style={{ ...panel, marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: "bold", fontSize: 13, color: "#e0e0e0" }}>「{displayName}」</span>
            {displayName !== companyName && (
              <span style={{ fontSize: 10, color: "#777", letterSpacing: 0.5 }}>{companyName.toUpperCase()}</span>
            )}
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
              <IconGlasses size={11} /> {t(lang, "companyPage.title")}
            </Link>
            {/* 分享按钮位置预留：navigator.share / 复制邀请链接 ?invite=1（本轮不实现） */}
          </div>

          {/* 全称：可反复发起表决修改（简称与地址永久不变） */}
          <div style={{ ...panel, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#888" }}>{t(lang, "detail.fullNameLabel")}</span>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#e0e0e0" }}>
                {state.org?.fullName ?? t(lang, "detail.fullNameEmpty")}
              </span>
              <span style={{ ...badge, color: "#8a8a5a" }}>
                {t(lang, "header.nameLocked", { name: companyName })}
              </span>
              {!editingFull && (
                <button
                  disabled={!!state.proposal}
                  title={state.proposal ? t(lang, "detail.votePending") : t(lang, "detail.fullNameHint")}
                  onClick={() => {
                    setEditingFull(true);
                    setFullNameDraft(state.org?.fullName ?? companyName);
                  }}
                  style={{
                    ...badge,
                    marginLeft: "auto",
                    background: "#101010",
                    color: state.proposal ? "#555" : "#76b900",
                    border: `1px solid ${state.proposal ? "#333" : "#3d5a1a"}`,
                    cursor: state.proposal ? "not-allowed" : "pointer",
                  }}
                >
                  {t(lang, "detail.changeFullName")}
                </button>
              )}
            </div>
            {editingFull && (
              <>
                <input
                  value={fullNameDraft}
                  onChange={(e) => setFullNameDraft(e.target.value)}
                  placeholder={t(lang, "header.fullNamePlaceholder")}
                  maxLength={COMPANY_FULLNAME_MAX}
                  aria-label={t(lang, "detail.fullNameLabel")}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 8,
                    padding: "8px 10px",
                    background: "#0d0d0d",
                    border: draftFullErr ? "1px solid #f55" : "1px solid #333",
                    borderRadius: 8,
                    color: "#e0e0e0",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={submitFullName}
                    disabled={!canProposeFullName}
                    style={{
                      ...voteBtn("#76b900", "#000"),
                      opacity: canProposeFullName ? 1 : 0.55,
                      cursor: canProposeFullName ? "pointer" : "not-allowed",
                    }}
                  >
                    {t(lang, "detail.fullNameSubmit")}
                  </button>
                  <button
                    onClick={() => {
                      setEditingFull(false);
                      setFullNameDraft("");
                    }}
                    style={voteBtn("#333", "#ccc")}
                  >
                    {t(lang, "detail.cancel")}
                  </button>
                </div>
                {draftFullErr ? (
                  <div style={{ fontSize: 11, color: "#f55", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <IconAlertTriangle size={12} /> {draftFullErr}
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>{t(lang, "detail.fullNameHint")}</div>
                )}
              </>
            )}
            {!editingFull && state.proposal && (
              <div style={{ fontSize: 10, color: "#8a8a5a", marginTop: 6 }}>{t(lang, "detail.votePending")}</div>
            )}
          </div>
        </>
      ) : (
        <p style={{ fontSize: 11, color: "#666", margin: "8px 0 0" }}>{t(lang, "companyDetail.empty")}</p>
      )}

      {/* ============ 7) 公司动态（全网公司排名已迁至 /public） ============ */}
      <LogFeed state={state} lang={lang} />
    </PageBody>
  );
}

