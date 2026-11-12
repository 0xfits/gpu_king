"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { annualYield, balanceParts, slugFromName, DEFAULT_COMPANY_NAME } from "../lib/game";
import { Lang, LANGS, t } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import {
  IconBuilding,
  IconPickaxe,
  IconShoppingCart,
  IconHeartHandshake,
  IconWallet,
  IconZap,
} from "./icons";
import { badge, voteBtn } from "./ui";

/** 单个导航项：标签一律由调用方算好（Co 项要带公司名） */
interface NavItem {
  href: string;
  label: string;
  active: boolean;
  icon: (p: { size?: number }) => React.ReactElement;
}

function NavLink({ href, label, active, icon: Icon }: NavItem) {
  return (
    <Link
      href={href}
      style={{
        ...voteBtn(active ? "#76b900" : "#1c1c1c", active ? "#000" : "#999"),
        fontSize: 12,
        padding: "6px 12px",
        border: "1px solid #333",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        textDecoration: "none",
      }}
    >
      <Icon size={13} />
      {label}
    </Link>
  );
}

/** 公共页眉：品牌 + 全局资源条 + 导航（Co / Public / Shop）+ 语言切换 */
export function AppHeader() {
  const { state, lang, setLang } = useGame();
  const pathname = usePathname();
  const parts = balanceParts(state.usd);
  const yieldNow = annualYield(state);

  const companyName =
    state.org && state.org.name !== DEFAULT_COMPANY_NAME ? state.org.name : "";
  const ownSlug = companyName ? slugFromName(companyName) : "";

  /** 三顶固定顺序：Co（公司中心页）/ Public（算力捐赠）/ Shop */
  const NAV: NavItem[] = [
    {
      href: "/",
      label: companyName ? t(lang, "nav.co", { name: companyName }) : t(lang, "nav.coEmpty"),
      // 公司公开页 /<slug> 也归属 Co 这一顶
      active: pathname === "/" || (!!ownSlug && pathname === `/${ownSlug}`),
      icon: IconBuilding,
    },
    {
      href: "/public",
      label: t(lang, "nav.public"),
      active: pathname === "/public",
      icon: IconHeartHandshake,
    },
    {
      href: "/shop",
      label: t(lang, "nav.shop"),
      active: pathname === "/shop",
      icon: IconShoppingCart,
    },
  ];

  return (
    <header style={{ borderBottom: "1px solid #222", background: "#101010" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h1 style={{ color: "#76b900", margin: 0, fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <IconBuilding size={19} />
            GPU_King
            {state.org && <span style={{ fontSize: 14, color: "#e0e0e0" }}>「{state.org.name}」</span>}
          </h1>
          <div style={{ display: "flex", gap: 4 }}>
            {LANGS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLang(l.key)}
                style={{
                  ...voteBtn(lang === l.key ? "#76b900" : "#222", lang === l.key ? "#000" : "#999"),
                  fontSize: 11,
                  padding: "3px 10px",
                  border: "1px solid #333",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* 全局资源条：公司 USD / HASH / 年化 */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
          <span style={{ ...badge, color: "#76b900", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <IconWallet size={11} />
            {parts.whole} <span style={{ fontSize: 10, opacity: 0.75 }}>{parts.pusd}</span>
          </span>
          <span style={{ ...badge, color: "#76b900", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <IconPickaxe size={11} />
            {Math.floor(state.hash).toLocaleString()} HASH
          </span>
          <span style={badge}>APY {(yieldNow * 100).toFixed(2)}%</span>
        </div>

        {/* 导航 */}
        <nav style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </div>
    </header>
  );
}

/** 公共页脚：规则说明 + 版本 */
export function AppFooter() {
  const { lang } = useGame();
  return (
    <footer style={{ borderTop: "1px solid #222", marginTop: 28 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 24px" }}>
        <p style={{ fontSize: 11, color: "#555", margin: 0 }}>{t(lang, "foot.note")}</p>
        <p style={{ fontSize: 10, color: "#3f3f3f", margin: "8px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
          <IconZap size={10} /> GPU_King · local MVP · v8
        </p>
      </div>
    </footer>
  );
}

/** 页面容器：统一宽度 */
export function PageBody({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "8px 24px 24px", fontFamily: "sans-serif" }}>
      {children}
    </main>
  );
}

/** 区块标题 */
export function SectionTitle({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <h2
      style={{
        margin: "22px 0 4px",
        fontSize: 13,
        color: "#888",
        textTransform: "uppercase",
        letterSpacing: 1,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {icon}
      {text}
    </h2>
  );
}
