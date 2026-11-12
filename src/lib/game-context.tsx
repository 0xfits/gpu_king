"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GameState,
  GameAction,
  initialState,
  applyAction,
  repairState,
  calcOfflineGain,
} from "./game";
import { Lang, loadLang, DEFAULT_LANG, LANG_KEY } from "./i18n";

const SAVE_KEY = "gpu-king-v8";
/** 旧存档键（gpu-tycoon 时代）：仅用于迁移读取，读到后写入新键，旧键保留不删 */
const LEGACY_SAVE_KEY = "gpu-tycoon-v8";

/**
 * 两阶段载入：SSR 与客户端首帧都用 initialState()（保证 hydration 文本一致），
 * 挂载后再 dispatch hydrate 把 loadInitial() 结果整体换上。
 * loadInitial 内部（旧键迁移 / 离线收益 / repairState）原样保留，全程只在客户端执行一次。
 */
function loadInitial(): GameState {
  if (typeof window === "undefined") return initialState();
  try {
    let saved = localStorage.getItem(SAVE_KEY);
    if (!saved) {
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      if (legacy) {
        localStorage.setItem(SAVE_KEY, legacy);
        saved = legacy;
      }
    }
    if (saved) {
      const parsed = JSON.parse(saved) as GameState;
      if (
        Array.isArray(parsed.members) &&
        parsed.members.every((m) => m.rep && typeof m.rep.dev === "number") &&
        typeof parsed.hash === "number" &&
        typeof parsed.capacity === "number" &&
        parsed.org !== undefined
      ) {
        const gain = calcOfflineGain(parsed);
        if (gain.usd > 0 || gain.hash > 0) {
          parsed.usd += gain.usd;
          parsed.dividends = (parsed.dividends ?? 0) + gain.usd;
          parsed.hash += gain.hash;
          parsed.log = [
            {
              k: "log.offline",
              p: { usd: gain.usd.toFixed(6), hash: gain.hash.toLocaleString() },
              at: Date.now(),
            },
            ...parsed.log,
          ].slice(0, 40);
        }
        parsed.lastSave = Date.now();
        return repairState(parsed);
      }
    }
  } catch {
    // ignore
  }
  return initialState();
}

function reducer(state: GameState, action: GameAction): GameState {
  return applyAction(state, action);
}

interface GameCtx {
  state: GameState;
  dispatch: (action: GameAction) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  flash: boolean;
  pulse: () => void;
}

const Ctx = createContext<GameCtx | null>(null);

export function useGame(): GameCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export function GameProvider({ children }: { children: ReactNode }) {
  // 1) 首帧（服务端 SSR 与客户端 hydration 第一趟）：两者都用 initialState()，文本逐字一致
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  // 语言同理：首帧固定默认 lang，挂载后才应用存储值
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  // 挂载完成标记：只有它为 true 才允许写回 LANG_KEY，避免把默认语言覆盖掉存储值
  const [hydrated, setHydrated] = useState(false);
  const [flash, setFlash] = useState(false);
  const lastTsRef = useRef<number>(Date.now());

  // 2) 挂载后：读存档（迁存、离线收益、repairState 一次性完成）+ 应用存储语言
  useEffect(() => {
    dispatch({ type: "hydrate", state: loadInitial() });
    setLang(loadLang());
    setHydrated(true);
  }, []);

  // 真实时间驱动：每一帧按实际经过秒数结算利息与被动 HASH
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = Date.now();
      const dt = (now - lastTsRef.current) / 1000;
      if (dt >= 0.05) {
        lastTsRef.current = now;
        dispatch({ type: "tick", dt });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 自动保存
  useEffect(() => {
    const id = setInterval(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, lastSave: Date.now() }));
    }, 5000);
    return () => clearInterval(id);
  }, [state]);

  useEffect(() => {
    // 首帧（hydrated=false）不写：否则默认 lang 会先把存储值冲掉
    if (!hydrated) return;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang, hydrated]);

  const pulse = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 100);
  };

  return (
    <Ctx.Provider value={{ state, dispatch, lang, setLang, flash, pulse }}>
      {children}
    </Ctx.Provider>
  );
}
