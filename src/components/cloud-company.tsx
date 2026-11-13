"use client";

import { useState } from "react";
import {
  COMPANY_FULLNAME_MAX,
  COMPANY_NAME_MAX,
  RESERVED_SLUGS,
  isValidCompanyFullName,
  isValidCompanyName,
  passVotesFor,
  slugFromName,
} from "../lib/game";
import { t } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import { panel, voteBtn } from "./ui";
import { IconAlertTriangle, IconBuilding, IconCloud } from "./icons";

/** notice / result 里的 msg 若是词典键（如 cloud.offline），展示时翻译一次 */
function msgLabel(lang: "zh-Hant" | "en", msg: string | undefined): string {
  if (!msg) return "";
  return msg.startsWith("cloud.") || msg.startsWith("header.") ? t(lang, msg) : msg;
}

/**
 * 云模式建司的「第二步」状态卡（命名表決）。
 *
 * 建司现在是两步（`createCompany`）：
 *   a) POST /api/import —— 未命名公司落库（slug 已定，org.name 仍是 GPU1）
 *   b) POST /api/actions `found` —— 命名提案，服务端替机器人股东补赞成票后同事务结算
 *
 * 这里只在 b 进行中 / b 失败后出现：
 * - `voting`  ：显示「命名表決進行中」+ 服务端返回的票数（机器人补票后应为 3:0）
 * - `pending` ：**公司已建、命名表決待完成** + 重试按钮（只重试 b，绝不重复 import）
 */
export function NamingStatusCard() {
  const { lang, naming, retryNaming, state } = useGame();
  if (!naming) return null;

  const busy = naming.phase !== "pending";
  const proposal = state.proposal;
  const showTally = !!proposal && proposal.phase === "voting";

  return (
    <div
      style={{
        ...panel,
        marginTop: 12,
        borderColor: naming.phase === "pending" ? "#fa0" : "#76b900",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: "bold",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {naming.phase === "pending" ? <IconAlertTriangle size={14} /> : <IconBuilding size={14} />}
        {naming.phase === "pending"
          ? t(lang, "cloud.namingPendingTitle")
          : t(lang, "cloud.namingBusy")}
      </div>

      <div style={{ fontSize: 11, color: "#8ab4f8", display: "flex", alignItems: "center", gap: 5 }}>
        <IconCloud size={11} />
        {t(lang, "cloud.namingCompany", {
          name: naming.name,
          full: naming.fullName ?? naming.name,
          slug: naming.slug,
        })}
      </div>

      {showTally && (
        <div style={{ fontSize: 12, marginTop: 6 }} data-testid="naming-tally">
          {t(lang, "vote.tally", {
            yes: proposal!.yes,
            no: proposal!.no,
            need: passVotesFor(state),
          })}
        </div>
      )}

      {naming.phase === "pending" ? (
        <>
          <div style={{ fontSize: 10, color: "#888", marginTop: 6 }}>
            {t(lang, "cloud.namingPendingHint")}
          </div>
          {naming.error && (
            <div
              style={{ fontSize: 11, color: "#f55", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}
              data-testid="naming-error"
            >
              <IconAlertTriangle size={12} />
              {naming.error.k === "cloud.namingFailed"
                ? t(lang, "cloud.namingFailed", {
                    msg: msgLabel(lang, String(naming.error.p?.msg ?? "")),
                  })
                : t(lang, naming.error.k, naming.error.p)}
            </div>
          )}
          <button
            onClick={() => void retryNaming()}
            style={{ ...voteBtn("#fa0", "#000"), width: "100%", marginTop: 10 }}
            data-testid="naming-retry"
          >
            {t(lang, "cloud.namingRetry")}
          </button>
        </>
      ) : (
        <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>
          {busy ? t(lang, "cloud.namingVotingHint") : null}
        </div>
      )}
    </div>
  );
}

/**
 * 云模式 · 云端无公司 ⇒ 建司表单（两步：import 未命名 → found 命名表決）。
 *
 * 「登录后不再沿用本机存档」的落点：这里提交的是 `initialState()`（**不写入简称/全称**），
 * 命名交给第二步的股东表决 —— 云模式与本地模式口径一致：新建公司也要投票。
 *
 * 校验与命名面板同源（`isValidCompanyName` / `isValidCompanyFullName`），
 * 服务端 `createFromLocal` 也再校验一遍：少一侧就等于留一条把非法名塞进库的通道。
 */
export function CloudCompanyPanel() {
  const { lang, createCompany, user, naming } = useGame();
  const [short, setShort] = useState("");
  const [full, setFull] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ k: string; p?: Record<string, string | number> } | null>(null);

  // 两步建司进行中 / 待重试 ⇒ 只显示状态卡（不允许再提交，避免重复 import 撞 slug）
  if (naming) return <NamingStatusCard />;

  const trimmed = short.trim();
  const fullTrimmed = full.trim();

  const shortErr = (() => {
    if (!trimmed) return "";
    if (isValidCompanyName(trimmed)) return "";
    return RESERVED_SLUGS.has(slugFromName(trimmed)) ? t(lang, "header.errReserved") : t(lang, "header.errChars");
  })();
  const fullErr = fullTrimmed && !isValidCompanyFullName(fullTrimmed) ? t(lang, "header.errFullName") : "";
  const canSubmit = !!trimmed && !shortErr && !fullErr && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    const res = await createCompany(trimmed, fullTrimmed || undefined);
    setBusy(false);
    if (res.ok) return;
    // naming：a 成功 b 失败 ⇒ 已切到状态卡（含重试），不再走这里的错误行
    if (res.error === "naming") return;
    if (res.error === "exists") setErr({ k: "cloud.createExists" });
    else if (res.error === "invalid") setErr({ k: "header.errChars" });
    else setErr({ k: "cloud.createFailed", p: { msg: msgLabel(lang, res.msg) } });
  };

  return (
    <div style={{ ...panel, marginTop: 12, borderColor: "#76b900" }}>
      <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <IconBuilding size={14} />
        {t(lang, "cloud.createTitle")}
      </div>
      <div style={{ fontSize: 11, color: "#8ab4f8", display: "flex", alignItems: "center", gap: 5 }}>
        <IconCloud size={11} />
        {user ? `${user.name} · ${t(lang, "cloud.noCompany")}` : t(lang, "cloud.noCompany")}
      </div>
      <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>{t(lang, "cloud.createHint")}</div>

      {/* 简称：字母在前、数字在后，1~6 位，决定 slug */}
      <div style={{ fontSize: 10, color: "#888", marginTop: 10 }}>{t(lang, "header.nameLabel")}</div>
      <input
        value={short}
        onChange={(e) => setShort(e.target.value)}
        placeholder={t(lang, "header.placeholder")}
        maxLength={COMPANY_NAME_MAX}
        aria-label={t(lang, "header.nameLabel")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 4,
          padding: "8px 10px",
          background: "#0d0d0d",
          border: shortErr ? "1px solid #f55" : "1px solid #333",
          borderRadius: 8,
          color: "#e0e0e0",
          fontSize: 13,
          outline: "none",
        }}
      />

      {/* 全称：可选，仅展示用，不影响 slug */}
      <div style={{ fontSize: 10, color: "#888", marginTop: 8 }}>{t(lang, "header.fullName")}</div>
      <input
        value={full}
        onChange={(e) => setFull(e.target.value)}
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
        onClick={submit}
        disabled={!canSubmit}
        style={{ ...voteBtn("#76b900", "#000"), width: "100%", marginTop: 10, opacity: canSubmit ? 1 : 0.55 }}
        data-testid="cloud-create"
      >
        {busy ? t(lang, "cloud.creating") : t(lang, "cloud.createBtn")}
      </button>

      {(shortErr || fullErr) && (
        <div style={{ fontSize: 11, color: "#f55", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
          <IconAlertTriangle size={12} /> {shortErr || fullErr}
        </div>
      )}
      {!shortErr && !fullErr && err && (
        <div
          style={{ fontSize: 11, color: "#f55", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}
          data-testid="cloud-create-error"
        >
          <IconAlertTriangle size={12} /> {t(lang, err.k, err.p)}
        </div>
      )}
      {!shortErr && !fullErr && !err && (
        <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>{t(lang, "header.nameOk")}</div>
      )}
    </div>
  );
}
