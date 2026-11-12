"use client";

import { useState } from "react";
import {
  GOODS,
  TOPUP_REGIONS,
  type TopupRegion,
  type Good,
  balanceParts,
  activeMembers,
  itemDurabilityLeft,
  itemHolding,
  spendableWallet,
  DURABILITY_DAYS,
} from "../../lib/game";
import { t } from "../../lib/i18n";
import { useGame } from "../../lib/game-context";
import { usdCostOf, useFxRates } from "../../lib/fx";
import { LogFeed } from "../../components/log-feed";
import { panel, voteBtn, iconBtn } from "../../components/ui";
import { PageBody } from "../../components/shell";
import { Modal } from "../../components/modal";
import {
  IconShoppingCart,
  IconShirt,
  IconGlasses,
  IconSmartphone,
  IconWallet,
  IconAlertTriangle,
} from "../../components/icons";

/** 地区 → 汇率币种（USD→CNY / USD→HKD） */
const FX_CURRENCIES: Record<TopupRegion, "CNY" | "HKD"> = { cn: "CNY", hk: "HKD" };

export default function ShopPage() {
  const { state, lang } = useGame();
  const [topupOpen, setTopupOpen] = useState(false);

  // 商店扣的是**当前操作人的个人可支配钱包**（wallets − lockedWallets），不是公司账户
  const myBalance = spendableWallet(state, state.activeId);
  const parts = balanceParts(myBalance);

  return (
    <PageBody>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <span style={{ ...iconBtn("#202020", "#e0e0e0", 34) }}>
          <IconShoppingCart size={18} />
        </span>
        <h2 style={{ color: "#76b900", margin: 0, fontSize: 18 }}>{t(lang, "shop.title")}</h2>
      </div>
      <p style={{ fontSize: 12, color: "#888", margin: "8px 0 0" }}>{t(lang, "shop.subtitle")}</p>

      {/* 个人可支配钱包余额（商店从个人钱包扣款，不扣公司账户） */}
      <div style={{ ...panel, textAlign: "center", background: "#1a1a1a", borderColor: "#76b900" }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
          {t(lang, "shop.personalBalance")}
        </div>
        <div style={{ fontWeight: "bold", color: "#76b900", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
          <IconWallet size={20} />
          <span style={{ fontSize: 22 }}>{parts.whole}</span>{" "}
          <span style={{ fontSize: 13, opacity: 0.75 }}>{parts.pusd}</span>
        </div>
        {myBalance <= 0 && (
          <div style={{ fontSize: 10, color: "#fa0", marginTop: 6 }}>
            {t(lang, "shop.lack.personal")}
          </div>
        )}
      </div>

      {/* 玩梗商品 */}
      {GOODS.map((good) => (
        <GoodRow key={good.id} good={good} />
      ))}

      {/* 手机话费充值：一行商品卡，点「購買」打开模态框 */}
      <div
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
          <span style={{ ...iconBtn("#181c2a", "#8ab4f8", 44) }}>
            <IconSmartphone size={22} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: "bold", fontSize: 13 }}>{t(lang, "shop.topup")}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{t(lang, "shop.topup.desc")}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTopupOpen(true)}
          style={{
            padding: "8px 14px",
            background: "#76b900",
            color: "#000",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: 12,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {t(lang, "shop.topup.open")}
        </button>
      </div>

      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} />}

      {!state.org && (
        <div style={{ ...panel, borderColor: "#f55" }}>
          <div style={{ fontSize: 12, color: "#f55", display: "flex", alignItems: "center", gap: 6 }}>
            <IconAlertTriangle size={14} /> {t(lang, "dissolved.title")}
          </div>
        </div>
      )}

      <LogFeed state={state} lang={lang} />
    </PageBody>
  );
}

/** 手机话费充值模态框：地区 / 面值 / 实时汇率折算 / 确认充值 */
function TopupModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch, lang } = useGame();
  const fx = useFxRates();
  const [regionKey, setRegionKey] = useState<TopupRegion>("cn");
  const [amount, setAmount] = useState<number>(100);

  const region = TOPUP_REGIONS.find((r) => r.key === regionKey)!;
  const rate = fx.rates[FX_CURRENCIES[regionKey]];
  const usd = usdCostOf(amount, rate);
  const canAct = !!state.org && !state.proposal && activeMembers(state).includes(state.activeId);
  // 扣款来源同商品：个人可支配钱包（wallets − lockedWallets），公司账户不参与
  const myBalance = spendableWallet(state, state.activeId);
  const short = myBalance < usd;
  const confirmDisabled = !canAct || short || fx.loading;

  // 切地区：当前面值不在新地区 amounts 内 → 自动切到该地区第 2 个面值
  const switchRegion = (key: TopupRegion) => {
    setRegionKey(key);
    const next = TOPUP_REGIONS.find((r) => r.key === key)!;
    if (!next.amounts.includes(amount)) setAmount(next.amounts[1]);
  };

  const confirm = () => {
    if (confirmDisabled) return;
    dispatch({ type: "topup", region: regionKey, amount, usdCost: usd, rate });
    onClose();
  };

  const renderRegionBtns = () => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {TOPUP_REGIONS.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => switchRegion(r.key)}
          style={{
            ...voteBtn(regionKey === r.key ? "#76b900" : "#222", regionKey === r.key ? "#000" : "#999"),
            fontSize: 11,
            padding: "4px 10px",
          }}
        >
          {t(lang, r.labelKey)}
        </button>
      ))}
    </div>
  );

  const renderAmountBtns = () => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
      {region.amounts.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => setAmount(a)}
          style={{
            ...voteBtn(amount === a ? "#76b900" : "#222", amount === a ? "#000" : "#999"),
            fontSize: 11,
            padding: "4px 10px",
          }}
        >
          {region.currency}
          {a}
        </button>
      ))}
    </div>
  );

  // 汇率行尾注：加载中 … / 离线兜底 warn 标签 + 数据来源行 / 在线时的日期与来源
  const renderFxMeta = () => {
    if (fx.loading) return <span style={{ fontSize: 10, color: "#666" }}>…</span>;
    if (fx.offline) {
      // 离线：pill 标签与「兜底来源」行都要在——否则用户看不出数据不是实时的
      return (
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            textAlign: "right",
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "#fa0",
              border: "1px solid #fa0",
              borderRadius: 999,
              padding: "1px 8px",
              fontWeight: "bold",
            }}
          >
            {t(lang, "shop.topup.fxOffline")}
          </span>
          <span style={{ fontSize: 10, color: "#fa0" }}>
            {t(lang, "shop.topup.fxFallbackMeta", { source: fx.source || "fallback" })}
          </span>
        </span>
      );
    }
    return (
      <span style={{ fontSize: 10, color: "#666" }}>
        {t(lang, "shop.topup.fxMeta", { date: fx.date || "-", source: fx.source })}
      </span>
    );
  };

  const renderLack = () => {
    if (!short) return null;
    return (
      <div style={{ fontSize: 10, color: "#f55", marginTop: 6 }}>
        {t(lang, "shop.lack", { n: (usd - myBalance).toFixed(2) })}
        {" · "}
        {t(lang, "shop.lack.personal")}
      </div>
    );
  };

  return (
    <Modal onClose={onClose} closeLabel={t(lang, "shop.topup.close")}>
      <div style={{ fontWeight: "bold", fontSize: 14, color: "#76b900", paddingRight: 30 }}>
        {t(lang, "shop.topup.modalTitle")}
      </div>

      <div style={{ fontSize: 11, color: "#888", marginTop: 12 }}>{t(lang, "shop.region")}</div>
      {renderRegionBtns()}

      <div style={{ fontSize: 11, color: "#888", marginTop: 10 }}>{t(lang, "shop.amount")}</div>
      {renderAmountBtns()}

      {/* 汇率行：1 USD ≈ {rate} {cur} + 日期/来源（离线时换成 warn 标签） */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid #262626",
        }}
      >
        <span style={{ fontSize: 11, color: "#9ab", fontFamily: "monospace" }}>
          {t(lang, "shop.topup.fx", { rate: rate.toFixed(4), cur: region.currency })}
        </span>
        {renderFxMeta()}
      </div>

      {/* 折算行：应付 USD */}
      <div style={{ fontSize: 14, fontWeight: "bold", color: "#76b900", marginTop: 8 }}>
        {t(lang, "shop.topup.cost", { usd: usd.toFixed(2) })}
      </div>
      {renderLack()}

      {/* 底部：取消 / 确认充值 */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose} style={{ ...voteBtn("#222", "#999"), flex: 1 }}>
          {t(lang, "shop.topup.cancel")}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={confirmDisabled}
          style={{
            ...voteBtn(confirmDisabled ? "#333" : "#76b900", confirmDisabled ? "#666" : "#000"),
            flex: 1,
          }}
        >
          {t(lang, "shop.topup.confirm")}
        </button>
      </div>
    </Modal>
  );
}

/** 商品行：耐用品展示剩余耐久进度（30 天，每日 -1），持有中不可再买 */
function GoodRow({ good }: { good: Good }) {
  const { state, dispatch, lang } = useGame();
  const owned = state.purchases[good.id] ?? 0;
  const holding = good.durable && itemHolding(state, good.id);
  const left = good.durable ? itemDurabilityLeft(state, good.id) : 0;
  const canAct = !!state.org && !state.proposal && activeMembers(state).includes(state.activeId);
  // 商店从个人可支配钱包扣款（wallets − lockedWallets），公司账户 state.usd 不参与
  const myBalance = spendableWallet(state, state.activeId);
  const affordable = myBalance >= good.price && canAct && !holding;
  return (
    <div
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
        <span style={{ ...iconBtn("#20182a", "#b9a6e8", 44) }}>
          {good.id === "jacket" ? <IconShirt size={22} /> : <IconGlasses size={22} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: "bold", fontSize: 13 }}>{t(lang, good.labelKey)}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{t(lang, good.descKey)}</div>
          {good.durable && left > 0 && (
            <div style={{ fontSize: 10, marginTop: 3 }}>
              <div
                style={{
                  width: 120,
                  height: 5,
                  background: "#262626",
                  borderRadius: 3,
                  overflow: "hidden",
                  display: "inline-block",
                  verticalAlign: "middle",
                  marginRight: 6,
                }}
              >
                <div
                  style={{
                    width: `${(left / DURABILITY_DAYS) * 100}%`,
                    height: "100%",
                    background: left > 10 ? "#76b900" : left > 3 ? "#fa0" : "#f55",
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <span style={{ color: "#76b900" }}>{t(lang, "shop.dur", { left, total: DURABILITY_DAYS })}</span>
            </div>
          )}
          {good.durable && left === 0 && owned > 0 && (
            <div style={{ fontSize: 10, color: "#fa0", marginTop: 2 }}>{t(lang, "shop.worn")}</div>
          )}
          {good.durable && holding && (
            <div style={{ fontSize: 10, color: "#8ab4f8", marginTop: 2 }}>{t(lang, "shop.holding")}</div>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <button
          disabled={!affordable}
          onClick={() => dispatch({ type: "buy", goodId: good.id })}
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
          {t(lang, "shop.buy")} · {good.price.toLocaleString()} USD
        </button>
        {holding && (
          <div style={{ fontSize: 10, color: "#8ab4f8", marginTop: 4 }}>{t(lang, "shop.dur", { left, total: DURABILITY_DAYS })}</div>
        )}
        {!affordable && !holding && myBalance < good.price && (
          <div style={{ fontSize: 10, color: "#f55", marginTop: 4 }}>
            {t(lang, "shop.lack", { n: (good.price - myBalance).toFixed(2) })}
            {" · "}
            {t(lang, "shop.lack.personal")}
          </div>
        )}
      </div>
    </div>
  );
}
