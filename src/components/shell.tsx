"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { annualYield, balanceParts, slugFromName, DEFAULT_COMPANY_NAME, companyDisplayName } from "../lib/game";
import { Lang, LANGS, t } from "../lib/i18n";
import { useGame } from "../lib/game-context";
import {
  IconBuilding,
  IconPickaxe,
  IconShoppingCart,
  IconHeartHandshake,
  IconWallet,
  IconZap,
  IconLogIn,
  IconLogOut,
  IconCloud,
  IconAlertTriangle,
  IconX,
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

/** 顶栏右侧的登录态区域：未登录 ⇒ Discord 登录链接；已登录 ⇒ 头像 + 名字 + 登出 */
function AuthArea() {
  const { lang, cloud, authLoading, user, signOut } = useGame();
  const [busy, setBusy] = useState(false);

  if (cloud && user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {user.avatar ? (
          // Discord CDN 头像（avatar 为空时回退首字母圆点，避免破图）
          <img
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
            alt={t(lang, "auth.avatarAlt", { name: user.name })}
            width={20}
            height={20}
            style={{ borderRadius: "50%", display: "block" }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#2a2a2a",
              color: "#76b900",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span
          title={user.name}
          style={{ fontSize: 11, color: "#ccc", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {user.name}
        </span>
        <button
          onClick={async () => {
            setBusy(true);
            await signOut();
            setBusy(false);
          }}
          disabled={busy}
          style={{
            ...voteBtn("#222", "#999"),
            fontSize: 11,
            padding: "3px 8px",
            border: "1px solid #333",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            opacity: busy ? 0.6 : 1,
          }}
        >
          <IconLogOut size={11} /> {t(lang, "auth.logout")}
        </button>
      </div>
    );
  }

  // 登录探测未返回时留白（避免「先显示登录链接再变头像」的闪烁与误点）
  if (authLoading) return null;

  return (
    <a
      href="/api/auth/login"
      style={{
        ...voteBtn("#5865f2", "#fff"),
        fontSize: 11,
        padding: "4px 10px",
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <IconLogIn size={12} /> {t(lang, "auth.login")}
    </a>
  );
}

/** 公共页眉：品牌 + 登录态 + 全局资源条 + 导航（Co / Public / Shop）+ 语言切换 */
export function AppHeader() {
  const {
    state,
    lang,
    setLang,
    cloud,
    company,
    unsynced,
    notice,
    dismissNotice,
    localSaveFound,
    localSaveDismissed,
    dismissLocalSave,
    clearLocalSave,
  } = useGame();
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
      // 菜單顯示統一轉大寫；companyName 原名仍用於 slug 與其它頁面展示
      label: companyName ? t(lang, "nav.co", { name: companyName.toUpperCase() }) : t(lang, "nav.coEmpty"),
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
            {(!cloud || company) && state.org && (
              <span style={{ fontSize: 14, color: "#e0e0e0" }}>「{companyDisplayName(state.org)}」</span>
            )}
          </h1>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <AuthArea />
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
          {cloud && company && (
            <span style={{ ...badge, color: "#8ab4f8", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <IconCloud size={11} />
              /{company.slug}
            </span>
          )}
          {cloud && unsynced && (
            <span style={{ ...badge, color: "#fa0", borderColor: "#5a4600" }}>{t(lang, "cloud.unsynced")}</span>
          )}
        </div>

        {/* 导航 */}
        <nav style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* 云模式提示条：冲突 / 登录过期 / 非成员 / 加载失败（可关闭，不打断操作） */}
        {notice && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${
                notice.kind === "error" ? "#6b2020" : notice.kind === "warn" ? "#5a4600" : "#2a3a1a"
              }`,
              background: "#141414",
              color: notice.kind === "error" ? "#ff8a8a" : notice.kind === "warn" ? "#fa0" : "#a5d36a",
            }}
          >
            <IconAlertTriangle size={12} />
            <span style={{ flex: 1 }}>{t(lang, notice.k, notice.p)}</span>
            <button
              onClick={dismissNotice}
              aria-label={t(lang, "cloud.dismiss")}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "inline-flex" }}
            >
              <IconX size={12} />
            </button>
          </div>
        )}

        {/* 已登录且本机仍有旧存档：只提示 + 手动清除（绝不自动删） */}
        {cloud && localSaveFound && !localSaveDismissed && (
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "#141414",
              color: "#999",
            }}
          >
            <IconCloud size={12} />
            <span style={{ flex: 1 }}>{t(lang, "cloud.localSave")}</span>
            <button
              onClick={clearLocalSave}
              style={{ ...badge, cursor: "pointer", background: "#101010", color: "#e0e0e0", border: "1px solid #444" }}
            >
              {t(lang, "cloud.clearLocal")}
            </button>
            <button
              onClick={dismissLocalSave}
              aria-label={t(lang, "cloud.dismiss")}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "inline-flex" }}
            >
              <IconX size={12} />
            </button>
          </div>
        )}
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
