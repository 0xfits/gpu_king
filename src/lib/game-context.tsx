"use client";

import {
  createContext,
  useCallback,
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
/** 非 tick action 落盘的 debounce 窗口（ms）：连续点击只写一次 */
const SAVE_DEBOUNCE_MS = 300;
/** 兜底节流写盘间隔（ms）：只建一次定时器，回调读 stateRef */
const SAVE_INTERVAL_MS = 5000;

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
  const [state, rawDispatch] = useReducer(reducer, undefined, initialState);
  // 语言同理：首帧固定默认 lang，挂载后才应用存储值
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  // 挂载完成标记：只有它为 true 才允许写回 LANG_KEY，避免把默认语言覆盖掉存储值
  const [hydrated, setHydrated] = useState(false);
  const [flash, setFlash] = useState(false);
  const lastTsRef = useRef<number>(Date.now());

  // ---- 存档层 ----
  // tick 每帧都改 state ⇒ 任何依赖 [state] 的定时器每帧都被重建（旧实现 5s 永远走不到）。
  // 现在：state 快照放 ref、定时器只建一次、落盘一律读 ref，timer 与 tick 频率解耦。
  const stateRef = useRef<GameState>(state);
  /** 已提交 state 的待落盘策略：debounce=非 tick action 后 300ms 写；now=立即写（pulse/隐藏） */
  const saveModeRef = useRef<"debounce" | "now" | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 存档已就位（hydrate 已提交）前一律不写，否则会拿 initialState 冲掉真存档 */
  const canSaveRef = useRef(false);

  /**
   * 唯一的写盘点：只做 localStorage.setItem，不改 state、不触发任何 React 更新
   * （否则 flush 会反过来引起 render → effect → flush 的循环）。语义与原实现一致：写入时盖 lastSave。
   */
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!canSaveRef.current) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ ...stateRef.current, lastSave: Date.now() }),
      );
    } catch {
      // 配额满 / 隐私模式：吞掉，不影响游戏
    }
  }, []);

  /** 只重排定时器，不写盘；真正写盘时读的是最新的 stateRef */
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flushSave();
    }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  /**
   * dispatch 包一层：tick（每帧）与 hydrate（来源本身就是存档）不排保存，
   * 其余 action 只标记「待 debounce 落盘」，由 state 提交后的 effect 消费 —— 保证写下去的是
   * 已提交的 state，而不是事件回调里的旧闭包。
   */
  const dispatch = useCallback((action: GameAction) => {
    rawDispatch(action);
    if (action.type === "tick" || action.type === "hydrate") return;
    saveModeRef.current = "debounce";
  }, []);

  // 每次提交后同步快照并消费「待落盘」意图（幂等：无意图时只更新 ref）
  useEffect(() => {
    stateRef.current = state;
    const mode = saveModeRef.current;
    if (!mode) return;
    saveModeRef.current = null;
    if (mode === "now") flushSave();
    else scheduleSave();
  }, [state, flushSave, scheduleSave]);

  // 2) 挂载后：读存档（迁存、离线收益、repairState 一次性完成）+ 应用存储语言
  useEffect(() => {
    dispatch({ type: "hydrate", state: loadInitial() });
    setLang(loadLang());
    setHydrated(true);
  }, [dispatch]);

  // hydrate 提交后才允许写盘
  useEffect(() => {
    if (hydrated) canSaveRef.current = true;
  }, [hydrated]);

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
  }, [dispatch]);

  // 自动保存：单次 interval（不依赖 state），读 ref 兜底写盘
  useEffect(() => {
    const id = setInterval(() => flushSave(), SAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      flushSave();
    };
  }, [flushSave]);

  // 卸载 / 隐藏 / 关闭兜底：不等 debounce，立即 flush 一次
  useEffect(() => {
    const onHide = () => flushSave();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushSave]);

  useEffect(() => {
    // 首帧（hydrated=false）不写：否则默认 lang 会先把存储值冲掉
    if (!hydrated) return;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang, hydrated]);

  const pulse = useCallback(() => {
    // pulse 跟在写操作（挖矿）之后：下一次提交立刻落盘，不等 300ms
    saveModeRef.current = "now";
    setFlash(true);
    setTimeout(() => setFlash(false), 100);
  }, []);

  return (
    <Ctx.Provider value={{ state, dispatch, lang, setLang, flash, pulse }}>
      {children}
    </Ctx.Provider>
  );
}
