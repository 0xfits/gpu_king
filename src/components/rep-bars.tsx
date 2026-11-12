import { REP_DOMAINS, type RepSet } from "../lib/game";
import { type Lang, t } from "../lib/i18n";
import { REP_ICONS } from "./icons";

export function repColor(n: number): string {
  if (n >= 70) return "#76b900";
  if (n >= 40) return "#fa0";
  return "#f55";
}

/**
 * 四域声望柱状图：图标内嵌柱体顶端。
 * 柱高按像素直接计算（百分比在 flex 列内不可解析，0~80 会塌陷），
 * 并保留最小柱高让图标始终可见。
 */
export function RepBars({
  rep,
  lang,
  height = 48,
}: {
  rep: RepSet;
  lang: Lang;
  height?: number;
}) {
  const barArea = height - 14; // 底部数值行占 14px
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
      {REP_DOMAINS.map((d) => {
        const v = rep[d.key];
        const Icon = REP_ICONS[d.key];
        const color = repColor(v);
        const barH = Math.max(16, Math.round((barArea * v) / 100));
        return (
          <div
            key={d.key}
            title={`${t(lang, d.labelKey)} ${v}`}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch" }}
          >
            <div style={{ height: barArea, display: "flex", alignItems: "flex-end" }}>
              <div
                style={{
                  width: "100%",
                  height: barH,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}44 100%)`,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                  paddingTop: 2,
                  transition: "height 0.3s",
                  color: "#0d0d0d",
                }}
              >
                <Icon size={10} />
              </div>
            </div>
            <div style={{ fontSize: 9, color, textAlign: "center", lineHeight: "14px" }}>{v}</div>
          </div>
        );
      })}
    </div>
  );
}
