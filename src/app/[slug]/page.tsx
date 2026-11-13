"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  REJOIN_DIVISOR,
  annualYield,
  balanceParts,
  marketCap,
  slugFromName,
  companyDisplayName,
} from "../../lib/game";
import { t } from "../../lib/i18n";
import { useGame } from "../../lib/game-context";
import { LogFeed } from "../../components/log-feed";
import { CompanyRepPanel, GpuGenerations, Shareholders } from "../../components/company-sections";
import { panel, badge, iconBtn } from "../../components/ui";
import { PageBody, SectionTitle } from "../../components/shell";
import {
  IconArrowLeft,
  IconBanknote,
  IconBuilding,
  IconGlobe,
  IconPickaxe,
  IconUser,
} from "../../components/icons";

/**
 * 公司公开页（/<slug>）：只读。
 * 与 Co 页共用 company-sections.tsx 的 Shareholders / GpuGenerations（readOnly=true），
 * 切换成员、罢免、归队、扩产、投票按钮全部 disabled；操作一律回 Co 页。
 */
export default function CompanyPublicPage() {
  const { state, lang } = useGame();
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params?.slug ?? "");
  const [copied, setCopied] = useState(false);

  const org = state.org;
  const selfSlug = org ? slugFromName(org.name) : "";
  const isMine = !!org && selfSlug === slug;
  /** 公开页展示全称（未填则回退简称）；slug 始终由简称生成 */
  const displayName = companyDisplayName(org);

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
          <Link
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 11, color: "#76b900", textDecoration: "none" }}
          >
            <IconArrowLeft size={11} /> {t(lang, "companyPage.backToCo")}
          </Link>
        </div>
      </PageBody>
    );
  }

  const parts = balanceParts(state.usd);
  const mcap = marketCap(state);

  return (
    <PageBody>
      {/* 公开页提示 + 返回 Co 页 */}
      <div
        style={{
          ...panel,
          marginTop: 8,
          padding: "10px 14px",
          borderColor: "#3a3a5a",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 11, color: "#8ab4f8", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <IconGlobe size={12} /> {t(lang, "companyPage.publicOnly", { name: displayName })}
        </span>
        <Link
          href="/"
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#76b900", textDecoration: "none" }}
        >
          <IconArrowLeft size={11} /> {t(lang, "companyPage.backToCo")}
        </Link>
      </div>

      {/* 公司头 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ ...iconBtn("#1c2418", "#76b900", 34) }}>
          <IconBuilding size={18} />
        </span>
        <h2 style={{ color: "#76b900", margin: 0, fontSize: 18 }}>{t(lang, "companyPage.title")}</h2>
        <span style={{ fontSize: 15, color: "#e0e0e0" }}>「{displayName}」</span>
        {displayName !== org!.name && (
          <span style={{ fontSize: 10, color: "#777", letterSpacing: 0.5 }}>{org!.name.toUpperCase()}</span>
        )}
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

      <CompanyRepPanel />

      {/* GPU 世代（只读） */}
      <SectionTitle icon={<IconPickaxe size={13} />} text={t(lang, "section.gpuGenerations")} />
      <GpuGenerations readOnly />

      {/* 股东（只读） */}
      <SectionTitle icon={<IconUser size={13} />} text={t(lang, "section.shareholders")} />
      <Shareholders readOnly />

      <LogFeed state={state} lang={lang} />
    </PageBody>
  );
}
