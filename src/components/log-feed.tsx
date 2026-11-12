import { type GameState } from "../lib/game";
import { type Lang, t, translateParams } from "../lib/i18n";

const panel: React.CSSProperties = {
  border: "1px solid #2a2a2a",
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
  background: "#141414",
};

/** 日志流：消息键+参数按当前语言渲染（三页共用） */
export function LogFeed({ state, lang }: { state: GameState; lang: Lang }) {
  return (
    <div style={{ ...panel, maxHeight: 160, overflowY: "auto" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 13, color: "#888" }}>{t(lang, "log.title")}</h2>
      {state.log.map((l, i) => (
        <div key={i} style={{ fontSize: 12, color: "#aaa", padding: "2px 0" }}>
          {/* 时间戳由 Date.now() 生成，服务端与客户端必然差秒 → 仅对该文本跳过 hydration 比对
              （React 官方推荐用法，等同于时钟类内容）；正文仍照常参与比对 */}
          <span suppressHydrationWarning>{new Date(l.at).toLocaleTimeString()}</span>
          {" · "}
          {t(lang, l.k, translateParams(lang, l.p))}
        </div>
      ))}
    </div>
  );
}
