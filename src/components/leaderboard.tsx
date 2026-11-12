"use client";

import { useState } from "react";
import { buildUsdBoard, buildHashBoard, type RankRow } from "../lib/game";
import { t } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import { panel, badge, voteBtn } from "./ui";
import { IconAlertTriangle } from "./icons";

/**
 * 全网公司排名单卡（USD 榜 / HASH 榜 双 tab，默认 USD）。
 * 自取 state 并调用本地模拟榜 buildUsdBoard / buildHashBoard；
 * Co 页（/）与 Public 页（/public）共用这一份，不要复制第二份。
 * 标题用调用方的 SectionTitle（rank.title），本组件只渲染卡片。
 */

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

export function Leaderboard() {
  const { state, lang } = useGame();
  const [tab, setTab] = useState<"usd" | "hash">("usd");
  const usdBoard = buildUsdBoard(state);
  const hashBoard = buildHashBoard(state);
  const rows = tab === "usd" ? usdBoard.rows : hashBoard.rows;
  const pick = tab === "usd" ? pickUsd : pickHash;
  const tabs: { key: "usd" | "hash"; label: string }[] = [
    { key: "usd", label: t(lang, "rank.tabUsd") },
    { key: "hash", label: t(lang, "rank.tabHash") },
  ];
  return (
    <div style={{ ...panel, marginTop: 8 }}>
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
