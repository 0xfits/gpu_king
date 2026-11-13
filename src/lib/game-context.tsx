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
  DEFAULT_COMPANY_NAME,
  RESERVED_SLUGS,
  initialState,
  applyAction,
  repairState,
  calcOfflineGain,
  isValidCompanyName,
  normalizeCompanyFullName,
  slugFromName,
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
 * 运行模式：
 * - `pending`：/api/auth/me 尚未返回。**什么都不写**（否则默认 state 会冲掉本机存档）
 * - `local`  ：未登录 ⇒ 全部沿用旧行为（localStorage 读写）
 * - `cloud`  ：已登录 ⇒ state 的权威来源是数据库；**绝不读写 localStorage['gpu-king-v8']**
 */
type Mode = "pending" | "local" | "cloud";

/** /api/auth/me 返回的账号 */
export interface AuthUser {
  id: string;
  name: string;
  avatar: string | null;
}

/** /api/auth/me 返回的「已绑定公司」 */
export interface MemberCompany {
  slug: string;
  name: string;
  fullName: string | null;
  memberId: string;
  owner: boolean;
}

/** 云端 state 的加载状态（云模式下驱动 UI：loading / 表单 / 正常页面） */
export type CloudStatus = "idle" | "loading" | "ready" | "no-company" | "error";

/**
 * 云模式提示条：只存**消息键 + 参数**，文案在展示层按当前语言解析
 * （与日志同一约定，切换语言时提示同步翻译）。
 */
export interface CloudNotice {
  kind: "info" | "warn" | "error";
  k: string;
  p?: Record<string, string | number>;
}

/** createCompany 的失败原因（文案在 UI 层用 t() 解析） */
export interface CreateCompanyResult {
  ok: boolean;
  error?: "invalid" | "exists" | "naming" | "failed";
  msg?: string;
}

/**
 * 云模式建司的「两步进度」：
 * - `importing`：步骤 a（POST /api/import，把未命名公司落库）进行中
 * - `voting`   ：步骤 b（POST /api/actions found，命名表決 + 服务端机器人补票）进行中
 * - `pending`  ：**a 成功、b 失败** ⇒ 公司已建，界面必须显示重试（只重试 b，不重复 import）
 */
export interface CloudNaming {
  slug: string;
  name: string;
  fullName: string | null;
  phase: "importing" | "voting" | "pending";
  /** pending 的原因（展示用；文案在 UI 层解析） */
  error?: CloudNotice | null;
}

/**
 * 两阶段载入（本地模式）：SSR 与客户端首帧都用 initialState()（保证 hydration 文本一致），
 * 挂载后再 dispatch hydrate 把 loadInitial() 结果整体换上。
 * loadInitial 内部（旧键迁移 / 离线收益 / repairState）原样保留，全程只在客户端执行一次。
 *
 * ⚠️ 只在**未登录**时调用：已登录时读本机存档就等于放任两边互相覆盖。
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
  /** 已登录（云模式生效：state 来自数据库，localStorage 不读不写） */
  cloud: boolean;
  /** /api/auth/me 尚未返回（首屏：不要断言任何数值） */
  authLoading: boolean;
  user: AuthUser | null;
  company: MemberCompany | null;
  cloudStatus: CloudStatus;
  /** 云端 state 的乐观锁版本号（POST /api/actions 的 expectedVersion） */
  version: number;
  notice: CloudNotice | null;
  dismissNotice: () => void;
  /** 云模式且无公司：在数据库新建公司（两步：import 未命名 → found 命名表決） */
  createCompany: (name: string, fullName?: string) => Promise<CreateCompanyResult>;
  /** 建司第二步（命名表決）的进度 / 待重试状态；null 表示没有进行中的建司流程 */
  naming: CloudNaming | null;
  /** 只重试建司第二步（命名表決），不会重复 import */
  retryNaming: () => Promise<void>;
  signOut: () => Promise<void>;
  /** 乐观更新但尚未确认落库的操作数 > 0（网络失败时置位，成功即清零） */
  unsynced: boolean;
  /** 云模式下检测到本机旧存档（只探测键存在，不读内容） */
  localSaveFound: boolean;
  localSaveDismissed: boolean;
  dismissLocalSave: () => void;
  clearLocalSave: () => void;
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

  // ---- 云模式状态 ----
  const [mode, setMode] = useState<Mode>("pending");
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<MemberCompany | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState<CloudNotice | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [localSaveFound, setLocalSaveFound] = useState(false);
  const [localSaveDismissed, setLocalSaveDismissed] = useState(false);
  /** 建司两步的进度（null = 无进行中的建司流程） */
  const [namingState, setNamingState] = useState<CloudNaming | null>(null);

  /** mode 的同步镜像：dispatch / flushSave 这类回调必须读到「此刻」的值，不能等 re-render */
  const modeRef = useRef<Mode>("pending");
  /** 当前公司（云模式）：action 同步时读 slug */
  const companyRef = useRef<MemberCompany | null>(null);
  /** 乐观锁版本：每次服务端响应后更新，下一次 action 用它当 expectedVersion */
  const versionRef = useRef(0);
  /** action 请求串行链：同一公司的写操作必须按顺序发，否则第二笔会带旧 version 撞 409 */
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  /** 开机只跑一次（StrictMode 双挂载也不会重复拉取/重复建公司） */
  const bootRef = useRef(false);
  /** 建司进度的同步镜像：retryNaming 必须读到「此刻」的 slug/简称，不能等 re-render */
  const namingRef = useRef<CloudNaming | null>(null);
  const setNameProc = useCallback((next: CloudNaming | null) => {
    namingRef.current = next;
    setNamingState(next);
  }, []);

  // ---- 存档层（仅本地模式）----
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
   *
   * ★ 云模式整体旁路：已登录时数据库是唯一权威，往 localStorage 写就等于
   *   在下次登出/换账号后把云端进度「漏」给本地模式（反之亦然）。
   */
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (modeRef.current !== "local") return;
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

  // ---- 云端读写 ----

  /**
   * 读一次权威 state（不碰 React state）：供「失败对账」用 ——
   * 网络半途失败时只有库里的值能说明 b 步骤到底有没有落地。
   */
  const fetchStateOnce = useCallback(
    async (slug: string): Promise<{ state: GameState; version: number } | null> => {
      try {
        const res = await fetch(`/api/state?slug=${encodeURIComponent(slug)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; state?: GameState; version?: number }
          | null;
        if (!res.ok || !body?.ok || !body.state) return null;
        return { state: repairState(body.state), version: Number(body.version) || 0 };
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * GET /api/state?slug= 覆盖本地（服务端读取时已结算，返回的就是权威值）
   * @param silent true ⇒ 不切 cloudStatus（礼盒开启后的增量刷新不该让整页闪「載入中」）
   */
  const loadCloudState = useCallback(
    async (slug: string, opts?: { silent?: boolean }): Promise<GameState | null> => {
      if (!opts?.silent) setCloudStatus("loading");
      try {
        const res = await fetch(`/api/state?slug=${encodeURIComponent(slug)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; state?: GameState; version?: number; msg?: string }
          | null;
        if (!res.ok || !body?.ok || !body.state) {
          setCloudStatus("error");
          setNotice({
            kind: "error",
            k: "cloud.loadFailed",
            p: { msg: body?.msg ?? `HTTP ${res.status}` },
          });
          return null;
        }
        const st = repairState(body.state);
        versionRef.current = Number(body.version) || 0;
        setVersion(versionRef.current);
        rawDispatch({ type: "hydrate", state: st });
        setUnsyncedCount(0);
        setCloudStatus("ready");
        return st;
      } catch {
        setCloudStatus("error");
        setNotice({ kind: "error", k: "cloud.loadFailed", p: { msg: "cloud.offline" } });
        return null;
      }
    },
    [],
  );

  /**
   * 把一次玩家操作发到 /api/actions（云模式）。
   *
   * 串行链 + 执行时读版本：连点两次 mine 时，第二笔必须用第一笔返回的新 version，
   * 否则自己撞自己的 409。
   * - 200 ⇒ 用服务端 state/version 覆盖（权威；顺带把乐观结果里 tick 的浮点误差抹平）
   * - 409 ⇒ 用服务端最新 state 覆盖（丢弃本次操作）+ 顶部提示
   * - 401/403 ⇒ 提示重新登录 / 非成员（不改数值：本地乐观结果留着，等用户重登）
   * - 其它 4xx ⇒ 提示被拒，并重拉一次以纠正乐观结果
   * - 网络失败 ⇒ **保留乐观结果**、标「待同步」，不弹窗；下次成功请求自然纠正
   */
  const postAction = useCallback(
    (action: GameAction) => {
      const render = () => {
        const slug = companyRef.current?.slug;
        if (!slug) return;
        const expectedVersion = versionRef.current;
        chainRef.current = chainRef.current.then(async () => {
          try {
            const res = await fetch("/api/actions", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ slug, action, expectedVersion }),
            });
            const body = (await res.json().catch(() => null)) as
              | {
                  ok?: boolean;
                  state?: GameState;
                  version?: number;
                  conflict?: boolean;
                  msg?: string;
                }
              | null;

            if (res.status === 409 && body?.state) {
              versionRef.current = Number(body.version) || versionRef.current;
              setVersion(versionRef.current);
              rawDispatch({ type: "hydrate", state: repairState(body.state) });
              setUnsyncedCount(0);
              setNotice({ kind: "warn", k: "cloud.conflict" });
              return;
            }
            if (res.ok && body?.ok && body.state) {
              versionRef.current = Number(body.version) || versionRef.current + 1;
              setVersion(versionRef.current);
              rawDispatch({ type: "hydrate", state: repairState(body.state) });
              setUnsyncedCount(0);
              return;
            }
            if (res.status === 401) {
              setNotice({ kind: "error", k: "cloud.relogin" });
              return;
            }
            if (res.status === 403) {
              setNotice({ kind: "error", k: "cloud.notMember" });
              return;
            }
            // 400 invalid_action 等：服务端没写库 ⇒ 重拉一次纠正乐观结果
            setNotice({ kind: "error", k: "cloud.rejected", p: { msg: body?.msg ?? `HTTP ${res.status}` } });
            await loadCloudState(slug);
          } catch {
            // 网络失败：保留乐观结果，只标「待同步」
            setUnsyncedCount((n) => n + 1);
          }
        });
      };
      render();
    },
    [loadCloudState],
  );

  /**
   * 云模式开礼盒：**不能走 /api/actions** —— `openGift` 刻意不在服务端 action 白名单里
   * （独立的开启语义 + 幂等校验），走通用通道会 400。
   *
   * 走 `POST /api/gifts/open`（成员校验 + 幂等 + state_version 推进），
   * 该路由只回增量（donationId / companyRep / version），所以成功后再 GET 一次拿权威 state。
   *
   * **不做本地乐观更新**：奖品是服务端按状态内确定性 rng 抽的，本地抽一次必然与服务端不同，
   * 乐观更新只会让玩家看到一个错的奖品再被抹掉。结果反馈以公司动态（log.giftOpen）为准。
   */
  const postGiftOpen = useCallback(
    (giftId: string) => {
      const slug = companyRef.current?.slug;
      if (!slug) return;
      chainRef.current = chainRef.current.then(async () => {
        try {
          const res = await fetch("/api/gifts/open", {
            method: "POST",
            credentials: "same-origin",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug, giftId }),
          });
          const body = (await res.json().catch(() => null)) as
            | { ok?: boolean; donationId?: string; labelKey?: string; repGain?: number; version?: number; msg?: string }
            | null;
          if (res.ok && body?.ok) {
            const v = Number(body.version);
            if (Number.isFinite(v)) {
              versionRef.current = v;
              setVersion(v);
            }
            await loadCloudState(slug, { silent: true });
            return;
          }
          if (res.status === 401) {
            setNotice({ kind: "error", k: "cloud.relogin" });
            return;
          }
          if (res.status === 403) {
            setNotice({ kind: "error", k: "cloud.notMember" });
            return;
          }
          // 400 gift_not_openable / 409：服务端未写库或被拒 ⇒ 提示 + 重拉纠正
          setNotice({
            kind: "error",
            k: "cloud.rejected",
            p: { msg: body?.msg ?? `HTTP ${res.status}` },
          });
          await loadCloudState(slug, { silent: true });
        } catch {
          // 网络失败：不改本地数值（本地没有权威礼盒状态），下次同步自然纠正
          setNotice({ kind: "error", k: "cloud.rejected", p: { msg: "cloud.offline" } });
        }
      });
    },
    [loadCloudState],
  );

  /**
   * dispatch 包一层：
   * - `tick`（每帧插值）/ `hydrate`（来源本身就是权威 state）⇒ 只跑 reducer，不同步、不落盘
   * - 云模式 ⇒ 先乐观更新，再串行 POST /api/actions
   *   （例外：`openGift` 走 /api/gifts/open，且**不做**本地乐观更新，见 postGiftOpen）
   * - 本地模式 ⇒ 只标记「待 debounce 落盘」，由 state 提交后的 effect 消费
   */
  const dispatch = useCallback(
    (action: GameAction) => {
      // 礼盒：云模式必须走专用路由（通用 /api/actions 会 400）
      if (action.type === "openGift" && modeRef.current === "cloud") {
        postGiftOpen(action.giftId);
        return;
      }
      rawDispatch(action);
      if (action.type === "tick" || action.type === "hydrate") return;
      if (modeRef.current === "cloud") {
        postAction(action);
        return;
      }
      if (modeRef.current === "local") saveModeRef.current = "debounce";
    },
    [postAction, postGiftOpen],
  );

  /**
   * 建司第二步：命名表決（POST /api/actions `found`）。
   *
   * 服务端在**同一事务**里为这张提案给 `discord_id is null` 的机器人股东补赞成票，
   * 所以一次 POST 回来就是「已命名」的 state（org.name=简称 / org.fullName /
   * nameLocked=true / proposal.phase=passed，且 ballots 含全部机器人的赞成票）。
   * 本函数只负责发请求、盖上服务端的 state、判定成功与否。
   *
   * 失败对账：网络半途失败时请求可能**已经落库**，此时重试必然 400（已命名后 found 被
   * reducer 拒）。所以失败一律先 GET 一次：库里已命名 ⇒ 视为成功，绝不把玩家卡在中间态。
   */
  const commitNaming = useCallback(
    async (
      slug: string,
      name: string,
      fullName: string | null,
    ): Promise<{ ok: boolean; state?: GameState; notice?: CloudNotice }> => {
      const post = async () => {
        const res = await fetch("/api/actions", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slug,
            action: { type: "found", name, ...(fullName ? { fullName } : {}) },
            expectedVersion: versionRef.current,
          }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; state?: GameState; version?: number; conflict?: boolean; msg?: string }
          | null;
        return { res, body };
      };

      /** 失败后对账：返回库里最新 state（null = 连库里都读不到） */
      const reconcile = async (): Promise<GameState | null> => {
        const truth = await fetchStateOnce(slug);
        if (!truth) return null;
        versionRef.current = truth.version;
        setVersion(truth.version);
        rawDispatch({ type: "hydrate", state: truth.state });
        return truth.state;
      };

      try {
        let { res, body } = await post();
        if (res.status === 409) {
          // 版本落后（并发写入推进了 state_version）：用库里最新版本重发一次
          const v = Number(body?.version);
          if (Number.isFinite(v) && v > 0) {
            versionRef.current = v;
            setVersion(v);
          }
          ({ res, body } = await post());
        }
        if (res.ok && body?.ok && body.state) {
          const st = repairState(body.state);
          versionRef.current = Number(body.version) || versionRef.current + 1;
          setVersion(versionRef.current);
          rawDispatch({ type: "hydrate", state: st });
          return { ok: true, state: st };
        }
        const truth = await reconcile();
        if (truth?.org && truth.org.name !== DEFAULT_COMPANY_NAME) return { ok: true, state: truth };
        if (res.status === 401) return { ok: false, notice: { kind: "error", k: "cloud.relogin" } };
        if (res.status === 403) return { ok: false, notice: { kind: "error", k: "cloud.notMember" } };
        return {
          ok: false,
          notice: {
            kind: "error",
            k: "cloud.namingFailed",
            p: { msg: body?.msg ?? `HTTP ${res.status}` },
          },
        };
      } catch {
        const truth = await reconcile();
        if (truth?.org && truth.org.name !== DEFAULT_COMPANY_NAME) return { ok: true, state: truth };
        return { ok: false, notice: { kind: "error", k: "cloud.namingFailed", p: { msg: "cloud.offline" } } };
      }
    },
    [fetchStateOnce],
  );

  /**
   * 云模式且云端无公司 ⇒ 建司，**两步**（命名必须股东表决，机器人股东只投赞成）：
   *
   * a) `POST /api/import`：提交 `initialState()` 的**未命名**形态 —— `org.name` 保持默认
   *    `GPU1`、不写 `fullName`、`nameLocked=false`；目标 slug 经 `slug` 参数显式给出
   *    （服务端 `slugHint`，带合法性与 `RESERVED_SLUGS` 校验）。此步只落库，不命名。
   * b) `POST /api/actions {type:"found", name, fullName}`：服务端建命名提案 → 为机器人
   *    股东补赞成票 → 同一事务落库，返回 `org.name=简称 / fullName / nameLocked=true`
   *    的 state。
   *
   * a 成功而 b 失败 ⇒ 页面显示「公司已建，命名表決待完成」+ 重试按钮（**只重试 b**）。
   */
  const createCompany = useCallback(
    async (name: string, fullName?: string): Promise<CreateCompanyResult> => {
      const short = name.trim();
      const full = normalizeCompanyFullName(fullName) ?? null;
      if (!isValidCompanyName(short)) return { ok: false, error: "invalid" };
      // slug 只由简称生成；保留路径（public/shop/donate）在客户端就拦掉
      const slug = slugFromName(short);
      if (RESERVED_SLUGS.has(slug)) return { ok: false, error: "invalid" };

      // —— 步骤 a：未命名落库 ——
      setNameProc({ slug, name: short, fullName: full, phase: "importing" });
      const base = initialState(); // org = { name: "GPU1", nameLocked: false, members: [u1,u2,u3] }
      const payload: GameState = { ...base, lastSave: Date.now() };
      let info: MemberCompany | null = null;
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: payload, slug }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; slug?: string; version?: number; memberId?: string; error?: string; msg?: string }
          | null;
        if (res.status === 409) {
          setNameProc(null);
          return { ok: false, error: "exists" };
        }
        if (!res.ok || !body?.ok || !body.slug) {
          setNameProc(null);
          return { ok: false, error: "failed", msg: body?.msg ?? `HTTP ${res.status}` };
        }
        info = {
          slug: body.slug,
          name: short, // 表決通過前 state.org.name 仍是 GPU1；这里只用于 UI/请求
          fullName: full,
          memberId: body.memberId ?? "",
          owner: true,
        };
        companyRef.current = info;
        versionRef.current = Number(body.version) || 1;
        setVersion(versionRef.current);
      } catch {
        setNameProc(null);
        return { ok: false, error: "failed", msg: "cloud.offline" };
      }

      // —— 步骤 b：命名表決（服务端机器人补票）——
      setNameProc({ slug: info.slug, name: short, fullName: full, phase: "voting" });
      const done = await commitNaming(info.slug, short, full);
      if (!done.ok) {
        // a 成功、b 失败：公司已在库里 ⇒ 只能重试 b，绝不再 import（slug 已被占）
        setNameProc({
          slug: info.slug,
          name: short,
          fullName: full,
          phase: "pending",
          error: done.notice ?? null,
        });
        return { ok: false, error: "naming" };
      }
      setNotice(null);
      const named: MemberCompany = {
        ...info,
        name: done.state?.org?.name ?? info.name,
        fullName: normalizeCompanyFullName(done.state?.org?.fullName) ?? info.fullName,
      };
      companyRef.current = named;
      setCompany(named);
      setNameProc(null);
      setCloudStatus("ready");
      return { ok: true };
    },
    [commitNaming, setNameProc],
  );

  /**
   * 只重试建司第二步（命名表決）。**不重复 import**：
   * 先用 GET 对齐版本 / 判定「上一次其实已落地」，再发 found。
   */
  const retryNaming = useCallback(async (): Promise<void> => {
    const cur = namingRef.current;
    if (!cur || cur.phase !== "pending") return;
    const info: MemberCompany = {
      slug: cur.slug,
      name: cur.name,
      fullName: cur.fullName,
      memberId: "",
      owner: true,
    };
    setNameProc({ ...cur, phase: "voting", error: null });

    const truth = await fetchStateOnce(cur.slug);
    if (truth) {
      versionRef.current = truth.version;
      setVersion(truth.version);
      rawDispatch({ type: "hydrate", state: truth.state });
      if (truth.state.org && truth.state.org.name !== DEFAULT_COMPANY_NAME) {
        // 上一次其实已经命名成功（只是响应丢了）
        companyRef.current = info;
        setCompany(info);
        setNameProc(null);
        setCloudStatus("ready");
        return;
      }
    }

    const done = await commitNaming(cur.slug, cur.name, cur.fullName);
    if (done.ok) {
      setNotice(null);
      const named: MemberCompany = {
        ...info,
        name: done.state?.org?.name ?? cur.name,
        fullName: normalizeCompanyFullName(done.state?.org?.fullName) ?? cur.fullName,
      };
      companyRef.current = named;
      setCompany(named);
      setNameProc(null);
      setCloudStatus("ready");
      return;
    }
    setNameProc({ ...cur, phase: "pending", error: done.notice ?? null });
  }, [commitNaming, fetchStateOnce, setNameProc]);

  /**
   * 刷新兜底：建司两步在「a 已落库、b 还没落库」之间刷新页面时，`/api/auth/me` 已经能查到
   * 这家公司 ⇒ 页面不会再回建司表单，命名提案会永远停在表决中（客户端补不了票：
   * 机器人成员位没有 discord_id）。这里在启动加载后补发一次 `found`：
   * 服务端对「提案已在表决中」的 found 是**幂等重试**（见 applyActionToCompany 的
   * found 重试分支），会替机器人股东补票并结算。
   */
  const resumeNaming = useCallback(
    async (slug: string, st: GameState) => {
      if (modeRef.current !== "cloud") return;
      if (!st.org || st.org.name !== DEFAULT_COMPANY_NAME) return;
      const p = st.proposal;
      if (!p || p.kind !== "naming" || p.phase !== "voting") return;
      const full = normalizeCompanyFullName(p.fullName) ?? null;
      setNameProc({ slug, name: p.name, fullName: full, phase: "voting" });
      const done = await commitNaming(slug, p.name, full);
      if (done.ok) {
        const prev = companyRef.current;
        const named: MemberCompany = {
          slug,
          name: done.state?.org?.name ?? p.name,
          fullName: normalizeCompanyFullName(done.state?.org?.fullName) ?? full,
          memberId: prev?.memberId ?? "",
          owner: prev?.owner ?? true,
        };
        companyRef.current = named;
        setCompany(named);
        setNameProc(null);
        setCloudStatus("ready");
        return;
      }
      setNameProc({ slug, name: p.name, fullName: full, phase: "pending", error: done.notice ?? null });
    },
    [commitNaming, setNameProc],
  );

  /** 登出：清掉云模式内存 state，回退本地模式（本机存档照旧可用） */
  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // 网络失败也照常切回本地模式：cookie 失效与否不影响本机玩法
    }
    modeRef.current = "local";
    setMode("local");
    setUser(null);
    setCompany(null);
    companyRef.current = null;
    versionRef.current = 0;
    setVersion(0);
    setCloudStatus("idle");
    setNotice(null);
    setUnsyncedCount(0);
    setLocalSaveFound(false);
    setLocalSaveDismissed(false);
    setNameProc(null);
    // 回退本地模式：重新读本机存档（这时 modeRef 已是 local，hydrate 不触发同步）
    rawDispatch({ type: "hydrate", state: loadInitial() });
  }, [setNameProc]);

  // 2) 开机：并行拿登录态；已登录走云模式，未登录沿用 localStorage
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    (async () => {
      setLang(loadLang());

      let me: { user: AuthUser; company: MemberCompany | null } | null = null;
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        if (res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { ok?: boolean; user?: AuthUser; company?: MemberCompany | null }
            | null;
          if (body?.ok && body.user?.id) {
            me = { user: body.user, company: body.company ?? null };
          }
        }
      } catch {
        // 网络失败 ⇒ 当未登录处理：至少还能本地玩（不会把云端进度写进本机存档）
      }

      if (!me) {
        modeRef.current = "local";
        setMode("local");
        setAuthLoading(false);
        dispatch({ type: "hydrate", state: loadInitial() });
        setHydrated(true);
        return;
      }

      // 已登录：云模式。**不读 localStorage 存档**，只探测「是否存在」用于提示。
      modeRef.current = "cloud";
      setMode("cloud");
      setUser(me.user);
      setAuthLoading(false);
      try {
        if (localStorage.getItem(SAVE_KEY)) setLocalSaveFound(true);
      } catch {
        // 隐私模式读不到 localStorage：忽略
      }

      if (me.company) {
        companyRef.current = me.company;
        setCompany(me.company);
        const st = await loadCloudState(me.company.slug);
        // 建司第二步没走完就刷新了：补一次命名表決（服务端幂等）
        if (st) await resumeNaming(me.company.slug, st);
      } else {
        // 云端无公司：保持 initialState() 展示，页面引导新建（不读本机存档）
        setCloudStatus("no-company");
        dispatch({ type: "hydrate", state: initialState() });
      }
      setHydrated(true);
    })();
  }, [dispatch, loadCloudState, resumeNaming]);

  // 每次提交后同步快照并消费「待落盘」意图（幂等：无意图时只更新 ref）
  useEffect(() => {
    stateRef.current = state;
    const m = saveModeRef.current;
    if (!m) return;
    saveModeRef.current = null;
    if (modeRef.current !== "local") return;
    if (m === "now") flushSave();
    else scheduleSave();
  }, [state, flushSave, scheduleSave]);

  // hydrate 提交后才允许写盘
  useEffect(() => {
    if (hydrated) canSaveRef.current = true;
  }, [hydrated]);

  // 真实时间驱动：每一帧按实际经过秒数结算利息与被动 HASH
  // （云模式下这是秒级插值展示，权威值以服务端结算为准）
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

  // 自动保存：单次 interval（不依赖 state），读 ref 兜底写盘（云模式内部整体旁路）
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
    // pulse 跟在写操作（挖矿）之后：本地模式下一次提交立刻落盘，不等 300ms
    saveModeRef.current = "now";
    setFlash(true);
    setTimeout(() => setFlash(false), 100);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const dismissLocalSave = useCallback(() => setLocalSaveDismissed(true), []);
  /** 只删本机存档键（旧键一并删，避免下次被「迁移」回来）；绝不自动执行 */
  const clearLocalSave = useCallback(() => {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // 隐私模式：忽略
    }
    setLocalSaveFound(false);
    setLocalSaveDismissed(false);
  }, []);

  return (
    <Ctx.Provider
      value={{
        state,
        dispatch,
        lang,
        setLang,
        flash,
        pulse,
        cloud: mode === "cloud",
        authLoading,
        user,
        company,
        cloudStatus,
        version,
        notice,
        dismissNotice,
        createCompany,
        naming: namingState,
        retryNaming,
        signOut,
        unsynced: unsyncedCount > 0,
        localSaveFound,
        localSaveDismissed,
        dismissLocalSave,
        clearLocalSave,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
