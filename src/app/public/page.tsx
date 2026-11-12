"use client";

import {
  DONATIONS,
  donationCost,
  REP_DOMAINS,
  activeMembers,
  memberById,
} from "../../lib/game";
import { t, memberLabel } from "../../lib/i18n";
import { useGame } from "../../lib/game-context";
import { RepBars } from "../../components/rep-bars";
import { LogFeed } from "../../components/log-feed";
import { panel, badge, iconBtn } from "../../components/ui";
import { PageBody } from "../../components/shell";
import {
  IconHeartHandshake,
  IconPickaxe,
  IconCoffee,
  IconKeyboard,
  IconSnowflake,
  IconMegaphone,
  IconBuilding,
} from "../../components/icons";

const DONATE_ICONS: Record<string, (p: { size?: number }) => React.ReactElement> = {
  coffee: IconCoffee,
  keyboard: IconKeyboard,
  snowflake: IconSnowflake,
  megaphone: IconMegaphone,
};

const badgeTone = (n: number): string => (n >= 70 ? "#76b900" : n >= 40 ? "#fa0" : "#f55");

/** Public 页（原 /donate，现路由 /public）：算力捐赠，导航第二顶 */
export default function PublicPage() {
  const { state, dispatch, lang } = useGame();
  const active = memberById(state, state.activeId);
  const nameOf = (id: string) => memberLabel(lang, memberById(state, id)?.name ?? id);
  const canAct = !!state.org && !state.proposal && activeMembers(state).includes(state.activeId);

  return (
    <PageBody>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ ...iconBtn("#1c2418", "#76b900", 34) }}>
          <IconHeartHandshake size={18} />
        </span>
        <h2 style={{ color: "#76b900", margin: 0, fontSize: 18 }}>{t(lang, "public.title")}</h2>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "8px 0 0" }}>{t(lang, "donate.subtitle")}</p>

      {/* HASH 余额 */}
      <div style={{ ...panel, textAlign: "center", background: "#1a1a1a", borderColor: "#76b900" }}>
        <div style={{ fontWeight: "bold", color: "#76b900", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <IconPickaxe size={20} />
          {Math.floor(state.hash).toLocaleString()} HASH
        </div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          {t(lang, "donate.balance", { n: Math.floor(state.hash).toLocaleString() })}
        </div>
      </div>

      {/* 受益人：当前操作成员（个人 + 公司品牌同时显示） */}
      {active && (
        <div style={{ ...panel, borderColor: "#3a3a5a" }}>
          <div style={{ fontSize: 12, color: "#bbb", display: "flex", alignItems: "center", gap: 6 }}>
            {t(lang, "hash.note", { m: nameOf(active.id) })}
          </div>
          <RepBars rep={active.rep} lang={lang} height={44} />
        </div>
      )}

      {DONATIONS.map((item) => {
        const times = state.donations[item.id] ?? 0;
        const cost = donationCost(item, times);
        const affordable = state.hash >= cost && canAct;
        const Icon = DONATE_ICONS[item.id];
        const domainLabel = REP_DOMAINS.find((d) => d.key === item.domain)?.labelKey ?? item.domain;
        const personal = active ? active.rep[item.domain] : 0;
        const companyVal = state.companyRep[item.domain];
        return (
          <div
            key={item.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 0",
              borderBottom: "1px solid #262626",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
              <span style={{ ...iconBtn("#1c2418", "#76b900", 44) }}>
                <Icon size={22} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: "bold", fontSize: 13 }}>{t(lang, item.labelKey)}</div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {t(lang, item.descKey, { n: item.repGain })}
                </div>
                <div style={{ fontSize: 10, marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: badgeTone(personal) }}>
                    {t(lang, "donate.personalNow", { m: active ? nameOf(active.id) : "?", v: personal })}
                  </span>
                  <span style={{ color: "#8ab4f8", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <IconBuilding size={9} />
                    {t(lang, "donate.companyNow", { v: companyVal })}{" "}
                    <span style={{ color: "#555" }}>{t(lang, domainLabel)}</span>
                  </span>
                  {times > 0 && <span style={{ color: "#76b900" }}>{t(lang, "donate.times", { n: times })}</span>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <button
                disabled={!affordable}
                onClick={() => dispatch({ type: "donate", donationId: item.id })}
                style={{
                  padding: "8px 14px",
                  background: affordable ? "#76b900" : "#333",
                  color: affordable ? "#000" : "#666",
                  border: "none",
                  borderRadius: 8,
                  cursor: affordable ? "pointer" : "not-allowed",
                  fontWeight: "bold",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                {t(lang, "donate.cost", { n: cost.toLocaleString() })}
              </button>
              <div style={{ fontSize: 10, marginTop: 3 }}>
                <span style={{ color: "#76b900" }}>{t(lang, "donate.gain", { n: item.repGain })}</span>
                {!affordable && state.hash < cost && (
                  <span style={{ color: "#f55" }}>
                    {" · "}
                    {t(lang, "donate.lack", { n: Math.ceil(cost - state.hash).toLocaleString() })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ ...panel, borderColor: "#3a3a5a" }}>
        <div style={{ fontWeight: "bold", fontSize: 13, color: "#8ab4f8", display: "flex", alignItems: "center", gap: 6 }}>
          <IconBuilding size={14} /> {t(lang, "companyRep.title")}
        </div>
        <RepBars rep={state.companyRep} lang={lang} height={48} />
        <p style={{ fontSize: 10, color: "#666", margin: "6px 0 0" }}>{t(lang, "companyRep.link")}</p>
      </div>

      <LogFeed state={state} lang={lang} />
    </PageBody>
  );
}
