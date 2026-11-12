// GPU_King — 阶段 0：三人合资 · USD 真实时间生息（5% 地板）· HASH 扩产 · 提案投票 · 贡献度 · 四域声望
// 日志以「消息键+参数」存储，语言（繁體/English）在展示层解析，切换语言时历史日志同步翻译。

export interface GPU {
  id: string;
  name: string;
  year: number;
  /** 每台设备部署的产能 HASH/s：被动产出 HASH，并提高 USD 年化利率 */
  baseHashrate: number;
  /** 建造成本，以 HASH 支付 */
  cost: number;
  /** 扩产失败的基础概率：越新的架构越不确定 */
  failBase: number;
}

/** 19 款虚构产品：命名风格致敬现实 GPU 产品线，但均不对应真实型号 */
export const GPUS: GPU[] = [
  { id: "gx256", name: "Georix 256", year: 1999, baseHashrate: 1, cost: 10, failBase: 0.05 },
  { id: "gxfx", name: "Georix FX", year: 2001, baseHashrate: 2, cost: 18, failBase: 0.06 },
  { id: "gx680", name: "Georix 680U", year: 2004, baseHashrate: 3, cost: 26, failBase: 0.07 },
  { id: "gx880", name: "Georix GT 880", year: 2006, baseHashrate: 4, cost: 34, failBase: 0.08 },
  { id: "cmpx", name: "ComputeX", year: 2007, baseHashrate: 6, cost: 50, failBase: 0.1 },
  { id: "teslyn", name: "Teslyn", year: 2008, baseHashrate: 8, cost: 70, failBase: 0.11 },
  { id: "fermax", name: "Fermax", year: 2010, baseHashrate: 11, cost: 95, failBase: 0.12 },
  { id: "kelvine", name: "Kelvine", year: 2012, baseHashrate: 16, cost: 130, failBase: 0.14 },
  { id: "maxvane", name: "Maxvane", year: 2014, baseHashrate: 24, cost: 190, failBase: 0.16 },
  { id: "voltyra", name: "Voltyra", year: 2016, baseHashrate: 36, cost: 280, failBase: 0.18 },
  { id: "tursor", name: "Tursor", year: 2018, baseHashrate: 54, cost: 420, failBase: 0.2 },
  { id: "ampyra", name: "Ampyra", year: 2020, baseHashrate: 80, cost: 620, failBase: 0.23 },
  { id: "hopwick", name: "Hopwick", year: 2021, baseHashrate: 120, cost: 920, failBase: 0.26 },
  { id: "ardalux", name: "Ardalux", year: 2022, baseHashrate: 180, cost: 1_400, failBase: 0.29 },
  { id: "feynica", name: "Feynica", year: 2023, baseHashrate: 270, cost: 2_100, failBase: 0.32 },
  { id: "blkreek", name: "Blackcreek", year: 2024, baseHashrate: 400, cost: 3_200, failBase: 0.35 },
  { id: "rubix", name: "Rubix", year: 2025, baseHashrate: 600, cost: 4_800, failBase: 0.38 },
  { id: "hertzian", name: "Hertzian", year: 2026, baseHashrate: 900, cost: 7_200, failBase: 0.41 },
  { id: "exaion", name: "Exaion", year: 2028, baseHashrate: 1_350, cost: 11_000, failBase: 0.45 },
];

export const COMPANY_SIZE = 3;

// —— 捐赠页：花费 HASH 向社会各界捐赠算力，换取该领域声望 ——
export interface Donation {
  id: string;
  /** 受益的声望域 */
  domain: RepDomain;
  labelKey: string;
  descKey: string;
  /** 每次捐赠获得的声望 */
  repGain: number;
  baseCost: number;
  growth: number;
}

export const DONATIONS: Donation[] = [
  { id: "coffee", domain: "dev", labelKey: "donate.coffee", descKey: "donate.coffee.desc", repGain: 2, baseCost: 25, growth: 1.4 },
  { id: "keyboard", domain: "factory", labelKey: "donate.keyboard", descKey: "donate.keyboard.desc", repGain: 2, baseCost: 40, growth: 1.5 },
  { id: "snowflake", domain: "ai", labelKey: "donate.snowflake", descKey: "donate.snowflake.desc", repGain: 3, baseCost: 80, growth: 1.6 },
  { id: "megaphone", domain: "media", labelKey: "donate.megaphone", descKey: "donate.megaphone.desc", repGain: 3, baseCost: 50, growth: 1.5 },
];

/** 捐赠价格随累计次数成长（HASH 计价） */
export function donationCost(item: Donation, times: number): number {
  return Math.ceil(item.baseCost * Math.pow(item.growth, times));
}

// —— 消费商店：花 USD 的纯消费（玩梗商品，无数值回报） ——
export interface Good {
  id: string;
  labelKey: string;
  descKey: string;
  price: number;
  /** 耐用品：同时只能持有 1 件，耐久 DURABILITY_DAYS 天，每天 -1，归零后方可再购 */
  durable?: boolean;
}

export const GOODS: Good[] = [
  { id: "jacket", labelKey: "shop.jacket", descKey: "shop.jacket.desc", price: 800, durable: true },
  { id: "glasses", labelKey: "shop.glasses", descKey: "shop.glasses.desc", price: 120, durable: true },
];

/** 耐用品当前状态（按真实时间惰性折算，无需 tick 扣减） */
export function itemDurabilityLeft(state: GameState, goodId: string): number {
  const it = state.items[goodId];
  if (!it) return 0;
  const days = Math.floor((Date.now() - it.boughtAt) / (SEC_PER_DAY * 1000));
  return Math.max(0, DURABILITY_DAYS - days);
}

export function itemHolding(state: GameState, goodId: string): boolean {
  return !!state.items[goodId] && itemDurabilityLeft(state, goodId) > 0;
}

export function itemBroken(state: GameState, goodId: string): boolean {
  return !!state.items[goodId] && itemDurabilityLeft(state, goodId) === 0;
}

/** 手机话费充值：选地区与面值（当地货币；按实时汇率折算 USD 扣款） */
export type TopupRegion = "cn" | "hk";
export const TOPUP_REGIONS: {
  key: TopupRegion;
  labelKey: string;
  currency: string;
  amounts: number[];
}[] = [
  { key: "cn", labelKey: "shop.region.cn", currency: "¥", amounts: [50, 100, 200, 300, 500] },
  { key: "hk", labelKey: "shop.region.hk", currency: "HK$", amounts: [50, 100, 200, 500, 1000] },
];
/** 三人共同出资：每人 200 USD，合计 600 */
export const SEED_MONEY = 200;
export const START_CAPITAL = SEED_MONEY * COMPANY_SIZE;
/** 成立公司直接消耗注册费 100（三人均摊，从公司账户扣） */
export const INCORPORATION_FEE = 100;
/** 开局账户余额：600 − 100 = 500 USD */
export const START_FUNDS = START_CAPITAL - INCORPORATION_FEE;
/** 简单多数：3 人公司需 2 票 */
export const PASS_VOTES = 2;
/** 贡献度低于全队均值该比例时，可被投票踢出公司 */
export const IDLE_SHARE = 0.4;

/** 市值口径：公司账户余额（USD）；归队补缴 = 市值 / REJOIN_DIVISOR */
export const REJOIN_DIVISOR = 3;
export function marketCap(state: GameState): number {
  return state.usd;
}
export function rejoinCost(state: GameState): number {
  return marketCap(state) / REJOIN_DIVISOR;
}

// —— 经济模型 ——
/** 地板年化：5%，无需任何产能即开始缓慢生息 */
export const YIELD_FLOOR = 0.05;
/** 前中期年化上限：20% */
export const YIELD_CAP = 0.2;
/** 后期年化上限：25% */
export const YIELD_CAP_LATE = 0.25;
/** 后期门槛：累计部署产能达到 250 HASH/s */
export const LATE_GAME_CAPACITY = 250;
/** 每部署 1 HASH/s 产能，年化 +0.05%（在 5% 地板之上叠加） */
export const YIELD_PER_HASH = 0.0005;
/** 被动 HASH 产出降速：名义产能 × 0.02 = 实际每秒 HASH（100 HASH/s 产能 ≈ 2 HASH/s 实际） */
export const HASH_PASSIVE_SCALE = 0.02;
/** 真实秒数/天 */
export const SEC_PER_DAY = 86400;
/** 耐用品：每天消耗 1 点耐久，归零前不可再买 */
export const DURABILITY_DAYS = 30;
/** 真实秒数/年 */
export const SEC_PER_YEAR = 365 * 24 * 3600;
/** 离线收益最多结算 24 个真实小时 */
export const OFFLINE_CAP_SEC = 24 * 3600;

// —— 四域声望 ——
export type RepDomain = "dev" | "factory" | "media" | "ai";
export const REP_DOMAINS: { key: RepDomain; labelKey: string; weight: number }[] = [
  { key: "dev", labelKey: "rep.dev", weight: 0.3 },
  { key: "factory", labelKey: "rep.factory", weight: 0.4 },
  { key: "media", labelKey: "rep.media", weight: 0.1 },
  { key: "ai", labelKey: "rep.ai", weight: 0.2 },
];
export type RepSet = Record<RepDomain, number>;
/** 扩产执行成功：硬件工厂 +5、AI 公司 +2 */
export const REP_SUCCESS_GAIN = 5;
export const REP_AI_GAIN = 2;
/** 扩产执行失败：硬件工厂 −15 */
export const REP_FAIL_PENALTY = 15;
/** 被罢免（公开除名）：媒体 −10 */
export const REP_KICK_MEDIA_PENALTY = 10;
/** 每累计 20 次点击：开发者 +1 */
export const DEV_REP_STEP = 20;
/** 新人/归队四域基准 */
export const NEWBIE_REP = 50;

export interface Member {
  id: string;
  /** 成员代号（A/B/C），显示名由展示层按语言拼接 */
  name: string;
  /** 贡献度 = 累计点击次数 */
  contribution: number;
  /** 四域声望，各 0~100 */
  rep: RepSet;
}

/** 邀请礼盒：邀请方每成功邀 1 人得 1 个，不自动开，必须用户点击开启 */
export interface GiftBox {
  id: string;
  opened: boolean;
  /** 发放时刻（毫秒） */
  at: number;
  /** 产生该礼盒的邀请方公司 slug（便于日志与展示溯源） */
  from?: string;
}

export type Org = { name: string; members: string[] } | null;

/** 公司命名：仅允许字母+数字，1~20 位，严格拒绝其它字符 */
export const COMPANY_NAME_RE = /^[A-Za-z0-9]{1,20}$/;
/** 保留路径：公司名不能与静态路由冲突，保证 /<slug> 地址可用（donate 保留仅为旧链接重定向） */
export const RESERVED_SLUGS = new Set(["public", "shop", "donate"]);
/** 公司网络地址 slug：命名后即为固定地址 /<slug> */
export function slugFromName(name: string): string {
  return name.toLowerCase();
}
export function isValidCompanyName(name: string): boolean {
  return COMPANY_NAME_RE.test(name) && !RESERVED_SLUGS.has(slugFromName(name));
}
export const DEFAULT_COMPANY_NAME = "GPU1";

/** 日志条目：消息键 + 参数，展示时按当前语言翻译 */
export interface LogEntry {
  k: string;
  p?: Record<string, string | number>;
  at: number;
}

export interface GameState {
  /** 公司 USD 资金池（浮点，展示拆为 USD + pUSD 双段） */
  usd: number;
  /** 累计可分配利润（利息计提），成员离开时按贡献占比分红 */
  dividends: number;
  /** 公司声望四域：与个人声望不同，但通过捐赠/扩产/罢免互相联动 */
  companyRep: RepSet;
  /** 成员个人钱包：离队结算款暂存于此，归队时用于补缴 */
  wallets: Record<string, number>;
  /**
   * 赠金余额（邀请注册所得 200 USD）：**不可提现、不可消费**（商店/充值一律不可用），
   * 只能用于出资（成立 / 归队补缴）。
   */
  grants: Record<string, number>;
  /**
   * 赠金孳息锁定额：已进入个人钱包、但由赠金派生的那部分，同样**仅限出资**。
   * 与 wallets 是「账内子账」关系：锁定额包含在 wallets 里，
   * spendableWallet(state,id) = wallets − lockedWallets。
   */
  lockedWallets: Record<string, number>;
  /** 邀请礼盒列表（不自动开；开启随机得一项捐赠的公司声望） */
  gifts: GiftBox[];
  /**
   * 累计出资与其中赠金来源（grants + lockedWallets 计入 fromGrants），
   * 用于离队结算时按 fromGrants/total 拆分红的可支配/锁定比例。
   */
  funding: Record<string, { total: number; fromGrants: number }>;
  /** 捐赠页：donationId -> 累计次数（HASH 计价，声望即时生效） */
  donations: Record<string, number>;
  /** 消费商店：goodId -> 购买次数；topup:<region>:<amount> -> 充值次数 */
  purchases: Record<string, number>;
  /** 耐用品持有：goodId -> 购入时间戳（唯一持有，耐久按真实天数消耗） */
  items: Record<string, { boughtAt: number }>;
  /** 可支配 HASH 余额：点击 +1/次，产能被动产出 */
  hash: number;
  /** 已部署产能 HASH/s：扩产落地，驱动被动 HASH 并提高利率 */
  capacity: number;
  owned: Record<string, number>;
  members: Member[];
  org: Org;
  activeId: string;
  proposal: Proposal | null;
  /** 确定性 RNG 状态，保证 reducer 纯函数、可测试 */
  rng: number;
  log: LogEntry[];
  lastSave: number;
}

export interface Proposal {
  gpuId: string;
  proposerId: string;
  yes: number;
  no: number;
  ballots: Record<string, boolean>;
  phase: "voting" | "passed" | "rejected" | "failed";
}

export type GameAction =
  /** 挂载后整体替换：把 localStorage 存档（loadInitial 结果）盖到 SSR 首帧状态上 */
  | { type: "hydrate"; state: GameState }
  | { type: "tick"; dt: number }
  | { type: "switch"; memberId: string }
  | { type: "mine" }
  | { type: "propose"; gpuId: string }
  | { type: "ballot"; memberId: string; yes: boolean }
  | { type: "kick"; targetId: string }
  | { type: "quit" }
  | { type: "recruit"; memberId: string }
  | { type: "found"; name: string }
  | { type: "rename"; name: string }
  | { type: "donate"; donationId: string }
  | { type: "buy"; goodId: string }
  | { type: "topup"; region: TopupRegion; amount: number; usdCost: number; rate: number }
  /** 开启邀请礼盒（不自动开；已开/不存在 → 返回同一引用，服务端映射 400） */
  | { type: "openGift"; giftId: string }
  | { type: "close" };

export function initialState(seed = 20261112): GameState {
  const members: Member[] = [
    { id: "u1", name: "A", contribution: 0, rep: { dev: 70, factory: 55, media: 60, ai: 50 } },
    { id: "u2", name: "B", contribution: 0, rep: { dev: 50, factory: 60, media: 45, ai: 55 } },
    { id: "u3", name: "C", contribution: 0, rep: { dev: 40, factory: 45, media: 55, ai: 60 } },
  ];
  return {
    usd: START_FUNDS,
    dividends: 0,
    companyRep: { ...COMPANY_REP_INIT },
    wallets: Object.fromEntries(members.map((m) => [m.id, 0])),
    grants: {},
    lockedWallets: {},
    gifts: [],
    funding: {},
    donations: {},
    purchases: {},
    items: {},
    hash: 0,
    capacity: 0,
    owned: {},
    members,
    org: { name: DEFAULT_COMPANY_NAME, members: members.map((m) => m.id) },
    activeId: "u1",
    proposal: null,
    rng: seed >>> 0,
    log: [
      {
        k: "log.boot",
        p: { cap: START_CAPITAL, fee: INCORPORATION_FEE, funds: START_FUNDS },
        at: Date.now(),
      },
    ],
    lastSave: Date.now(),
  };
}

export function gpuById(id: string): GPU | undefined {
  return GPUS.find((g) => g.id === id);
}

export function memberById(state: GameState, id: string): Member | undefined {
  return state.members.find((m) => m.id === id);
}

// —— 双池模型：赠金池（grants + lockedWallets）与可支配钱包 ——
// 赠金（邀请注册 200 USD）与它派生的孳息都**不可提现、不可消费**：
// 消费通道（buy/topup）只从「当前操作人（activeId）的可支配钱包」扣款，
// 既不碰公司账户 state.usd，也不碰 grants / lockedWallets 两池。
// 赠金只能用于出资（成立 / 归队补缴）；分红进钱包时按「赠金出资占比」拆出锁定部分。

/** 未使用的赠金余额（仅限出资） */
export function grantBalance(state: GameState, id: string): number {
  return state.grants?.[id] ?? 0;
}

/** 可支配个人钱包 = wallets − lockedWallets（不含任何赠金派生额） */
export function spendableWallet(state: GameState, id: string): number {
  const w = state.wallets?.[id] ?? 0;
  const l = state.lockedWallets?.[id] ?? 0;
  return Math.max(0, w - l);
}

/** 锁定总额（已进钱包的赠金孳息，仅限出资）；赠金本金在 grants 池，见 grantBalance */
export function lockedTotal(state: GameState, id: string): number {
  return state.lockedWallets?.[id] ?? 0;
}

/** 未开启的邀请礼盒（礼盒不自动开，必须用户点击） */
export function pendingGifts(state: GameState): GiftBox[] {
  return (state.gifts ?? []).filter((g) => !g.opened);
}

/** 赠金出资占比 = fromGrants / total（无出资记录 → 0，即分红全额可支配） */
export function grantShareRatio(state: GameState, id: string): number {
  const f = state.funding?.[id];
  if (!f || !(f.total > 0)) return 0;
  return clamp01(f.fromGrants / f.total);
}

/**
 * 分红拆分：按赠金出资占比把一笔钱拆成「可支配」与「锁定」两份。
 * fromGrants=100 / total=200 ⇒ 一半进 lockedWallets；无出资记录 ⇒ 全额可支配。
 */
export function splitByGrantShare(
  state: GameState,
  id: string,
  amount: number,
): { spendable: number; locked: number } {
  const safe = Math.max(0, amount);
  const locked = safe * grantShareRatio(state, id);
  return { spendable: safe - locked, locked };
}

/** 出资扣款所需的四个池（内部使用：按值拷贝，调用方整体写回，保持 reducer 纯函数） */
interface FundingPools {
  grants: Record<string, number>;
  wallets: Record<string, number>;
  lockedWallets: Record<string, number>;
  funding: Record<string, { total: number; fromGrants: number }>;
}

/**
 * 一次出资扣款，来源顺序固定：
 *   1) grants[id]（赠金本金）→ 2) 可支配钱包 → 3) 锁定孳息（同样是赠金派生，计入 fromGrants）；
 * 并把实付累加进 funding[id]（total=实付，fromGrants=其中赠金来源）。
 * 不足部分按实付记账，**不会**让任何池变负。
 */
function payForFunding(
  pools: FundingPools,
  id: string,
  want: number,
): { paid: number; fromGrants: number } {
  let left = Math.max(0, want);
  let fromGrants = 0;

  const g = Math.min(pools.grants[id] ?? 0, left);
  if (g > 0) {
    pools.grants[id] = (pools.grants[id] ?? 0) - g;
    left -= g;
    fromGrants += g;
  }

  const spendable = Math.max(0, (pools.wallets[id] ?? 0) - (pools.lockedWallets[id] ?? 0));
  const s = Math.min(spendable, left);
  if (s > 0) {
    pools.wallets[id] = (pools.wallets[id] ?? 0) - s;
    left -= s;
  }

  const lockedAvail = Math.min(pools.lockedWallets[id] ?? 0, pools.wallets[id] ?? 0);
  const l = Math.min(lockedAvail, left);
  if (l > 0) {
    pools.wallets[id] = (pools.wallets[id] ?? 0) - l;
    pools.lockedWallets[id] = (pools.lockedWallets[id] ?? 0) - l;
    left -= l;
    fromGrants += l;
  }

  const paid = Math.max(0, want - left);
  if (paid > 0) {
    const prev = pools.funding[id] ?? { total: 0, fromGrants: 0 };
    pools.funding[id] = {
      total: prev.total + paid,
      fromGrants: prev.fromGrants + fromGrants,
    };
  }
  return { paid, fromGrants };
}

/** 从 state 复制出一份可变的出资池快照（纯函数：调用方不改原 state） */
function fundingPoolsOf(state: GameState): FundingPools {
  return {
    grants: { ...(state.grants ?? {}) },
    wallets: { ...(state.wallets ?? {}) },
    lockedWallets: { ...(state.lockedWallets ?? {}) },
    funding: JSON.parse(JSON.stringify(state.funding ?? {})) as FundingPools["funding"],
  };
}

/** 综合声望 = 四域按权重加权（决定扩产成功率） */
export function compositeRep(rep: RepSet): number {
  return REP_DOMAINS.reduce((sum, d) => sum + rep[d.key] * d.weight, 0);
}

/** 公司声望：对外品牌，与个人声望同构四域，但由集体行为联动 */
export const COMPANY_REP_INIT: RepSet = { dev: 50, factory: 55, media: 40, ai: 50 };
/** 扩产成功：公司品牌 硬件工厂 / AI 公司 各 +2 */
export const COMPANY_EXPAND_GAIN = 2;
/** 扩产失败：公司品牌 硬件工厂 -5 · 媒体 -2（同时照烧预算 HASH） */
export const COMPANY_EXPAND_FAIL_FAB = 5;
export const COMPANY_EXPAND_FAIL_MEDIA = 2;
/** 罢免闹翻：公司品牌 媒体 -3 */
export const COMPANY_KICK_MEDIA = 3;

/** 公司综合声望（品牌力） */
export function companyComposite(state: GameState): number {
  return compositeRep(state.companyRep);
}

/**
 * 扩产成功率口径：个人 70% + 公司品牌 30%。
 * 公司声誉是集体资产——个人刷再多捐赠，烂公司也带不动；好品牌能补个人短板。
 */
export function linkedComposite(state: GameState, rep: RepSet): number {
  return compositeRep(rep) * 0.7 + companyComposite(state) * 0.3;
}

/** 捐赠联动：公司同域获得半数声望（向上取整） */
export function companyDonateGain(repGain: number): number {
  return Math.ceil(repGain / 2);
}

/** 新人起始声望受公司品牌影响：品牌每高 5 点，起始 +1 */
export function newbieRep(state: GameState): number {
  return repClampSafe(NEWBIE_REP + Math.round((companyComposite(state) - 50) / 5));
}

function repClampSafe(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** 是否已进入后期：累计部署产能达到门槛，利率上限从 20% 放宽至 25% */
export function isLateGame(state: GameState): boolean {
  return state.capacity >= LATE_GAME_CAPACITY;
}

/** 当前 USD 年化利率 = 5% 地板 + 产能 × 0.05%，随阶段封顶（前中期 20%，后期 25%） */
export function annualYield(state: GameState): number {
  const cap = isLateGame(state) ? YIELD_CAP_LATE : YIELD_CAP;
  return Math.max(YIELD_FLOOR, Math.min(cap, YIELD_FLOOR + state.capacity * YIELD_PER_HASH));
}

/** 此刻每秒利息（USD/真实秒） */
export function usdPerSec(state: GameState): number {
  if (!state.org) return 0;
  return (state.usd * annualYield(state)) / SEC_PER_YEAR;
}

/** 此刻被动 HASH 产出（HASH/真实秒，含降速系数） */
export function hashPerSec(state: GameState): number {
  return state.org ? state.capacity * HASH_PASSIVE_SCALE : 0;
}

/** 综合声望越高，扩产成功率越高（60 为中性点） */
export function successChance(gpu: GPU, composite: number): number {
  return clamp01(1 - gpu.failBase - (60 - composite) * 0.004);
}

/** 1 USD = 1,000,000 pUSD；余额以浮点 USD 存储，仅展示时拆分 */
export const PUSD_PER_USD = 1_000_000;

/** 「700.000153 USD + 123456 pUSD」：前段截断到微分，零头折入 pUSD 实时跳动 */
export function formatBalance(usd: number): string {
  const safe = Math.max(0, usd);
  const micro = Math.floor(safe * PUSD_PER_USD);
  const whole = micro / PUSD_PER_USD;
  const pusd = Math.floor((safe * PUSD_PER_USD - micro) * PUSD_PER_USD);
  return `${whole.toFixed(6)} USD + ${pusd.toLocaleString()} pUSD`;
}

/** 余额拆分（USD 主段 / pUSD 副段），供展示层分字号渲染 */
export function balanceParts(usd: number): { whole: string; pusd: string } {
  const safe = Math.max(0, usd);
  const micro = Math.floor(safe * PUSD_PER_USD);
  const whole = micro / PUSD_PER_USD;
  const pusd = Math.floor((safe * PUSD_PER_USD - micro) * PUSD_PER_USD);
  return { whole: `${whole.toFixed(6)} USD`, pusd: `+ ${pusd.toLocaleString()} pUSD` };
}

/** 当前是否处于「踢人」表决 */
export function isKickVote(proposal: Proposal | null): boolean {
  return !!proposal && proposal.gpuId.startsWith("kick:");
}

export function kickTargetId(proposal: Proposal | null): string | null {
  if (!proposal || !proposal.gpuId.startsWith("kick:")) return null;
  return proposal.gpuId.slice("kick:".length);
}

/** 公司在册真人（排除空槽） */
export function activeMembers(state: GameState): string[] {
  return (state.org?.members ?? []).filter((id) => id !== "");
}

/**
 * 满员才可罢免：有空槽时禁止发起新的罢免案，
 * 必须先补位（归队）恢复 3 名在册成员，防止连锁罢免掏空公司。
 */
export function canBeKicked(state: GameState, memberId: string): boolean {
  if (!state.org) return false;
  if (activeMembers(state).length < COMPANY_SIZE) return false;
  if (state.proposal) return false;
  if (!state.org.members.includes(memberId) || memberId === "") return false;
  const total = activeMembers(state).reduce(
    (sum, id) => sum + (memberById(state, id)?.contribution ?? 0),
    0,
  );
  if (total === 0) return false;
  const avg = total / COMPANY_SIZE;
  const target = memberById(state, memberId);
  if (!target) return false;
  return target.contribution < avg * IDLE_SHARE;
}

/**
 * 离开结算：
 * - 被罢免：收回本金 SEED_MONEY + 分红（分红池 × 本人贡献占比）
 * - 主动辞职：本金 0，只按贡献占比结算分红
 */
export function leavePayout(
  state: GameState,
  memberId: string,
  kicked: boolean,
): { principal: number; dividend: number; total: number } {
  const principal = kicked ? SEED_MONEY : 0;
  const crew = activeMembers(state);
  const total = crew.reduce((sum, id) => sum + (memberById(state, id)?.contribution ?? 0), 0);
  const mine = memberById(state, memberId)?.contribution ?? 0;
  const dividend = total > 0 ? (state.dividends * mine) / total : 0;
  const owed = principal + dividend;
  const paid = Math.min(state.usd, owed);
  return {
    principal: Math.min(principal, paid),
    dividend: owed > 0 ? dividend * (paid / owed) : 0,
    total: paid,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function repClamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function pushLog(
  state: GameState,
  k: string,
  p?: Record<string, string | number>,
): GameState {
  return { ...state, log: [{ k, p, at: Date.now() }, ...state.log].slice(0, 40) };
}

function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  let r = t;
  r = Math.imul(r ^ (r >>> 15), r | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

function startVote(state: GameState, proposal: Proposal, log?: [string, Record<string, string | number>]): GameState {
  // 应投票人 = 在册真人 − 被罢免者（回避）；空槽不参与表决，避免卡死
  const electorate = activeMembers(state).filter((id) => id !== kickTargetId(proposal));
  let next: GameState = { ...state, proposal };
  if (log) next = pushLog(next, log[0], log[1]);
  if (electorate.length === 0) return { ...next, proposal: null };
  if (electorate.every((id) => id in proposal.ballots)) {
    return resolveProposal(next);
  }
  return next;
}

/** 成员离开（辞职或被罢免）：结算入个人钱包，席位留空槽；全员离开则公司解散 */
function removeMember(state: GameState, memberId: string, kicked: boolean): GameState {
  const payout = leavePayout(state, memberId, kicked);
  // 结算款入钱包：按「赠金出资占比」拆成可支配 + 锁定两份（赠金及其孳息不可提现）；
  // 无出资记录 ⇒ 占比 0 ⇒ 全额进可支配钱包（旧存档行为不变）
  const split = splitByGrantShare(state, memberId, payout.total);
  const wallets = { ...(state.wallets ?? {}) };
  const lockedWallets = { ...(state.lockedWallets ?? {}) };
  wallets[memberId] = (wallets[memberId] ?? 0) + split.spendable + split.locked;
  lockedWallets[memberId] = (lockedWallets[memberId] ?? 0) + split.locked;
  const members = (state.org?.members ?? []).map((id) => (id === memberId ? "" : id));
  const dissolved = members.every((id) => id === "");
  let out: GameState = {
    ...state,
    usd: Math.max(0, state.usd - payout.total),
    companyRep: kicked
      ? { ...state.companyRep, media: repClamp(state.companyRep.media - COMPANY_KICK_MEDIA) }
      : state.companyRep,
    wallets,
    lockedWallets,
    dividends: Math.max(0, state.dividends - payout.dividend),
    org: dissolved || !state.org ? null : { name: state.org.name, members },
    activeId: members.includes(state.activeId) ? state.activeId : (members.find((id) => id) ?? ""),
    members: kicked
      ? state.members.map((m) =>
          m.id === memberId
            ? { ...m, rep: { ...m.rep, media: repClamp(m.rep.media - REP_KICK_MEDIA_PENALTY) } }
            : m,
        )
      : state.members,
  };
  const p = {
    m: memberId,
    p: payout.principal.toFixed(6),
    d: payout.dividend.toFixed(6),
    t: payout.total.toFixed(6),
    media: REP_KICK_MEDIA_PENALTY,
    cmg: COMPANY_KICK_MEDIA,
  };
  out = pushLog(out, kicked ? "log.kickOut" : "log.quit", p);
  if (dissolved) out = pushLog(out, "log.dissolved");
  return out;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "hydrate": {
      // 存档整体替换（纯函数）：SSR/首帧与客户端一致，挂载后再换成存档；
      // 迁移、离线收益、repairState 全在 loadInitial 内完成，这里不再做任何计算
      return action.state;
    }

    case "tick": {
      // 真实时间连续结算：dt 为真实经过秒数（限幅防跳变）
      if (!state.org) return { ...state, lastSave: Date.now() };
      const dt = Math.max(0, Math.min(action.dt || 0, 3600));
      const interest = usdPerSec(state) * dt;
      return {
        ...state,
        usd: state.usd + interest,
        dividends: state.dividends + interest,
        hash: state.hash + hashPerSec(state) * dt,
        lastSave: Date.now(),
      };
    }

    case "switch": {
      if (!state.org?.members.includes(action.memberId)) return state;
      return { ...state, activeId: action.memberId };
    }

    case "mine": {
      // 点击手动挖矿：+1 HASH 余额，计入贡献度
      if (!state.org || !state.org.members.includes(state.activeId)) return state;
      return {
        ...state,
        hash: state.hash + 1,
        members: state.members.map((m) => {
          if (m.id !== state.activeId) return m;
          const contribution = m.contribution + 1;
          const dev =
            contribution % DEV_REP_STEP === 0 ? repClamp(m.rep.dev + 1) : m.rep.dev;
          return { ...m, contribution, rep: { ...m.rep, dev } };
        }),
      };
    }

    case "propose": {
      if (!state.org || state.proposal) return state;
      const gpu = gpuById(action.gpuId);
      if (!gpu || state.hash < gpu.cost) return state;
      const proposer = memberById(state, state.activeId);
      if (!proposer) return state;
      return startVote(state, {
        gpuId: gpu.id,
        proposerId: proposer.id,
        yes: 1,
        no: 0,
        ballots: { [proposer.id]: true },
        phase: "voting",
      });
    }

    case "kick": {
      if (!canBeKicked(state, action.targetId)) return state;
      const target = memberById(state, action.targetId);
      if (!target) return state;
      return startVote(
        state,
        {
          gpuId: `kick:${target.id}`,
          proposerId: state.activeId,
          yes: 1,
          no: 0,
          ballots: { [state.activeId]: true },
          phase: "voting",
        },
        ["log.kickStart", { by: state.activeId, target: target.id }],
      );
    }

    case "quit": {
      // 主动辞职：本金 0，只结算分红；表决期间不可离开
      if (!state.org || state.proposal) return state;
      if (!state.org.members.includes(state.activeId)) return state;
      return removeMember({ ...state, proposal: null }, state.activeId, false);
    }

    case "ballot": {
      const p = state.proposal;
      if (!p || p.phase !== "voting") return state;
      if (!activeMembers(state).includes(action.memberId)) return state;
      if (action.memberId === kickTargetId(p)) return state; // 被罢免者回避
      if (action.memberId in p.ballots) return state;

      const ballots = { ...p.ballots, [action.memberId]: action.yes };
      const next: Proposal = {
        ...p,
        ballots,
        yes: p.yes + (action.yes ? 1 : 0),
        no: p.no + (action.yes ? 0 : 1),
      };

      const electorate = activeMembers(state).filter((id) => id !== kickTargetId(next));
      if (electorate.some((id) => !(id in ballots))) {
        return { ...state, proposal: next };
      }
      return resolveProposal({ ...state, proposal: next });
    }

    case "recruit": {
      // 股东归队：补缴当前市值 1/3，注入公司池。
      // 资金来源优先赠金池（grants），不足再扣个人钱包（可支配 → 锁定孳息），并计入 funding
      if (!state.org || state.proposal) return state;
      const hasEmpty = state.org.members.some((id) => id === "");
      if (!hasEmpty || !state.members.some((m) => m.id === action.memberId)) return state;
      if (activeMembers(state).includes(action.memberId)) return state;
      const cost = rejoinCost(state);
      const pools = fundingPoolsOf(state);
      const available = (pools.grants[action.memberId] ?? 0) + (pools.wallets[action.memberId] ?? 0);
      if (available < cost) return state;
      const { paid } = payForFunding(pools, action.memberId, cost);
      const members = state.org.members.map((id) => (id === "" ? action.memberId : id));
      const nb = newbieRep(state);
      return {
        ...state,
        usd: state.usd + paid,
        grants: pools.grants,
        wallets: pools.wallets,
        lockedWallets: pools.lockedWallets,
        funding: pools.funding,
        org: { ...state.org, members },
        members: state.members.map((m) =>
          m.id === action.memberId
            ? {
                ...m,
                contribution: 0,
                rep: { dev: nb, factory: nb, media: nb, ai: nb },
              }
            : m,
        ),
        activeId: members.includes(state.activeId) ? state.activeId : action.memberId,
        log: pushLog(
          state,
          "log.recruit",
          { m: action.memberId, cost: paid.toFixed(6), cap: marketCap(state).toFixed(6), div: REJOIN_DIVISOR, nb },
        ).log,
      };
    }

    case "found": {
      // 重新成立公司：命名严格校验（字母+数字），缴注册费 100，分红池重置。
      // 创始人重新出资：每人 SEED_MONEY，**优先扣赠金池 grants，不足再扣个人钱包**，
      // 实付累加进 funding（fromGrants 只记赠金部分），并注入公司账户
      if (state.org) return state;
      if (!isValidCompanyName(action.name)) return state;
      const idle = state.members.filter((m) => !isInOrg(state, m.id));
      if (idle.length === 0) return state;
      if (state.usd < INCORPORATION_FEE) return state;
      const crew = idle.slice(0, COMPANY_SIZE).map((m) => m.id);
      const pools = fundingPoolsOf(state);
      let raised = 0;
      for (const id of crew) raised += payForFunding(pools, id, SEED_MONEY).paid;
      let out: GameState = {
        ...state,
        usd: state.usd + raised - INCORPORATION_FEE,
        grants: pools.grants,
        wallets: pools.wallets,
        lockedWallets: pools.lockedWallets,
        funding: pools.funding,
        dividends: 0,
        org: { name: action.name, members: crew },
        activeId: crew[0],
        members: state.members.map((m) =>
          crew.includes(m.id) ? { ...m, contribution: 0 } : m,
        ),
      };
      out = pushLog(out, "log.found", {
        name: action.name,
        fee: INCORPORATION_FEE,
        n: crew.length,
        seed: raised.toFixed(6),
      });
      return out;
    }

    case "rename": {
      // 首局开局命名：仅当公司仍为默认名时允许改一次
      if (!state.org || state.org.name !== DEFAULT_COMPANY_NAME) return state;
      if (!isValidCompanyName(action.name)) return state;
      let out: GameState = { ...state, org: { ...state.org, name: action.name } };
      out = pushLog(out, "log.rename", { name: action.name });
      return out;
    }

    case "donate": {
      // 捐赠：花费 HASH（价格随次数成长），当前操作人获得对应领域声望
      if (!state.org || state.proposal) return state;
      const item = DONATIONS.find((d) => d.id === action.donationId);
      if (!item) return state;
      const times = state.donations[item.id] ?? 0;
      const cost = donationCost(item, times);
      if (state.hash < cost) return state;
      const member = memberById(state, state.activeId);
      if (!member) return state;
      const cGain = companyDonateGain(item.repGain);
      let out: GameState = {
        ...state,
        hash: state.hash - cost,
        donations: { ...state.donations, [item.id]: times + 1 },
        companyRep: {
          ...state.companyRep,
          [item.domain]: repClamp(state.companyRep[item.domain] + cGain),
        },
        members: state.members.map((m) =>
          m.id === state.activeId
            ? {
                ...m,
                rep: { ...m.rep, [item.domain]: repClamp(m.rep[item.domain] + item.repGain) },
              }
            : m,
        ),
      };
      out = pushLog(out, "log.donate", {
        m: state.activeId,
        d: item.labelKey,
        cost,
        dom: REP_DOMAINS.find((x) => x.key === item.domain)?.labelKey ?? item.domain,
        gain: item.repGain,
        cg: cGain,
      });
      return out;
    }

    case "buy": {
      // 消费商店：**只**动当前操作人的可支配钱包（wallets − lockedWallets）。
      // 公司账户 state.usd 一分不动；赠金池 grants 与锁定池 lockedWallets 也不参与。
      // 余额不足（含只剩锁定部分）⇒ 返回同一引用，服务端映射 400 invalid_action、不写库。
      // 耐用品同时只能持有一件，耐久未耗尽前不可再买。
      if (!state.org || state.proposal) return state;
      const good = GOODS.find((g) => g.id === action.goodId);
      if (!good) return state;
      if (good.durable && itemHolding(state, good.id)) return state;
      const wallet = state.activeId;
      if (!memberById(state, wallet)) return state;
      // 只花可支配部分：spendable = wallets − lockedWallets ≥ price ⇒ 扣后 wallets ≥ locked ≥ 0
      if (spendableWallet(state, wallet) < good.price) return state;
      let out: GameState = {
        ...state,
        wallets: { ...state.wallets, [wallet]: (state.wallets[wallet] ?? 0) - good.price },
        purchases: { ...state.purchases, [good.id]: (state.purchases[good.id] ?? 0) + 1 },
        items: good.durable
          ? { ...state.items, [good.id]: { boughtAt: Date.now() } }
          : state.items,
      };
      out = good.durable
        ? pushLog(out, "log.buyDur", { m: state.activeId, g: good.labelKey, price: good.price, dur: DURABILITY_DAYS })
        : pushLog(out, "log.buy", { m: state.activeId, g: good.labelKey, price: good.price });
      return out;
    }

    case "topup": {
      // 手机话费充值：外部实时汇率折算 USD 扣款（reducer 纯函数，汇率由 UI 传入，不依赖网络）
      // 扣款来源同 buy：**只扣当前操作人的可支配钱包**，公司账户 state.usd 与 grants / lockedWallets 不动
      if (!state.org || state.proposal) return state;
      const region = TOPUP_REGIONS.find((r) => r.key === action.region);
      if (!region || !region.amounts.includes(action.amount)) return state;
      const { usdCost, rate } = action;
      if (!Number.isFinite(usdCost) || usdCost <= 0) return state;
      // 异常上限保护：扣款超过面值 5 倍视为荒谬值，直接拒绝
      if (usdCost > action.amount * 5) return state;
      const wallet = state.activeId;
      if (!memberById(state, wallet)) return state;
      if (usdCost > spendableWallet(state, wallet)) return state;
      const key = `topup:${region.key}:${action.amount}`;
      let out: GameState = {
        ...state,
        wallets: { ...state.wallets, [wallet]: (state.wallets[wallet] ?? 0) - usdCost },
        purchases: { ...state.purchases, [key]: (state.purchases[key] ?? 0) + 1 },
      };
      out = pushLog(out, "log.topup", {
        m: state.activeId,
        r: region.labelKey,
        cur: region.currency,
        amount: action.amount,
        usd: usdCost.toFixed(6),
        rate,
      });
      return out;
    }

    case "openGift": {
      // 邀请礼盒：必须手动开启；用状态内确定性 rng 抽 DONATIONS 四项之一（不用 Math.random）。
      // 已开 / 不存在 → 返回同一引用（服务端映射成 400 gift_not_openable）
      const list = state.gifts ?? [];
      const idx = list.findIndex((g) => g.id === action.giftId);
      if (idx < 0 || list[idx].opened) return state;
      const gift = list[idx];
      const [r, rng] = nextRandom(state.rng);
      const pick =
        DONATIONS[Math.min(DONATIONS.length - 1, Math.floor(r * DONATIONS.length))];
      if (!pick || !state.org) return state;
      let out: GameState = {
        ...state,
        rng,
        gifts: list.map((g, i) => (i === idx ? { ...g, opened: true } : g)),
        donations: { ...state.donations, [pick.id]: (state.donations[pick.id] ?? 0) + 1 },
        companyRep: {
          ...state.companyRep,
          [pick.domain]: repClamp(state.companyRep[pick.domain] + pick.repGain),
        },
      };
      out = pushLog(out, "log.giftOpen", {
        d: pick.labelKey,
        dom: REP_DOMAINS.find((x) => x.key === pick.domain)?.labelKey ?? pick.domain,
        gain: pick.repGain,
        from: gift.from ?? "—",
      });
      return out;
    }

    case "close": {
      if (!state.proposal || state.proposal.phase === "voting") return state;
      return { ...state, proposal: null };
    }

    default:
      return state;
  }
}

function isInOrg(state: GameState, id: string): boolean {
  return !!state.org?.members.includes(id);
}

function resolveProposal(state: GameState): GameState {
  const p = state.proposal;
  if (!p || p.phase !== "voting" || !state.org) return state;

  if (p.yes < PASS_VOTES) {
    return {
      ...state,
      proposal: { ...p, phase: "rejected" },
      log: pushLog(state, "log.rejected", { yes: p.yes, no: p.no }).log,
    };
  }

  // 罢免案：投票通过即生效，离开结算入钱包
  const kickId = kickTargetId(p);
  if (kickId) {
    return removeMember({ ...state, proposal: { ...p, phase: "passed" } }, kickId, true);
  }

  // 扩产案：以 HASH 出资；投票通过后结算成败，成败影响硬件工厂 / AI 公司声望
  const gpu = gpuById(p.gpuId);
  if (!gpu) return { ...state, proposal: { ...p, phase: "rejected" } };

  const proposer = memberById(state, p.proposerId);
  const chance = successChance(
    gpu,
    proposer ? linkedComposite(state, proposer.rep) : companyComposite(state),
  );
  const [roll, rng] = nextRandom(state.rng);
  const ok = roll < chance;
  const rollS = roll.toFixed(2);
  const chanceS = `${Math.round(chance * 100)}%`;

  if (ok) {
    let out: GameState = {
      ...state,
      rng,
      hash: state.hash - gpu.cost,
      capacity: state.capacity + gpu.baseHashrate,
      owned: { ...state.owned, [gpu.id]: (state.owned[gpu.id] || 0) + 1 },
      companyRep: {
        ...state.companyRep,
        factory: repClamp(state.companyRep.factory + COMPANY_EXPAND_GAIN),
        ai: repClamp(state.companyRep.ai + COMPANY_EXPAND_GAIN),
      },
      members: state.members.map((m) =>
        m.id === p.proposerId
          ? {
              ...m,
              rep: {
                ...m.rep,
                factory: repClamp(m.rep.factory + REP_SUCCESS_GAIN),
                ai: repClamp(m.rep.ai + REP_AI_GAIN),
              },
            }
          : m,
      ),
      proposal: { ...p, phase: "passed" },
    };
    out = pushLog(
      out,
      "log.expandOk",
      {
        gpu: gpu.name,
        cost: gpu.cost,
        h: gpu.baseHashrate,
        roll: rollS,
        chance: chanceS,
        m: p.proposerId,
        f: REP_SUCCESS_GAIN,
        a: REP_AI_GAIN,
        cg: COMPANY_EXPAND_GAIN,
      },
    );
    return out;
  }

  let out: GameState = {
    ...state,
    rng,
    hash: state.hash - gpu.cost,
    companyRep: {
      ...state.companyRep,
      factory: repClamp(state.companyRep.factory - COMPANY_EXPAND_FAIL_FAB),
      media: repClamp(state.companyRep.media - COMPANY_EXPAND_FAIL_MEDIA),
    },
    members: state.members.map((m) =>
      m.id === p.proposerId
        ? { ...m, rep: { ...m.rep, factory: repClamp(m.rep.factory - REP_FAIL_PENALTY) } }
        : m,
    ),
    proposal: { ...p, phase: "failed" },
  };
  out = pushLog(
    out,
    "log.expandFail",
    { gpu: gpu.name, roll: rollS, chance: chanceS, cost: gpu.cost, m: p.proposerId, f: REP_FAIL_PENALTY, cff: COMPANY_EXPAND_FAIL_FAB, cfm: COMPANY_EXPAND_FAIL_MEDIA },
  );
  return out;
}

// —— 全网公司排名（本地 MVP：对手为游戏内模拟条目，真实联网留待后端阶段） ——
export interface RivalCompany {
  name: string;
  mcap: number;
  hash: number;
}

export const RIVALS: RivalCompany[] = [
  { name: "SiliconMonk", mcap: 482_300, hash: 31_500 },
  { name: "NineLattice", mcap: 220_500, hash: 18_400 },
  { name: "VolcanixAI", mcap: 95_800, hash: 9_120 },
  { name: "PixelForge", mcap: 41_200, hash: 4_050 },
  { name: "DeepQuarry", mcap: 18_900, hash: 2_200 },
  { name: "NullChip", mcap: 6_400, hash: 820 },
  { name: "ByteGarden", mcap: 2_100, hash: 300 },
  { name: "FogRiver", mcap: 950, hash: 120 },
];

export interface RankRow {
  name: string;
  mcap: number;
  hash: number;
  self: boolean;
  dissolved?: boolean;
}

interface Board {
  rows: RankRow[];
  myRank: number;
}

function rankRows(state: GameState): RankRow[] {
  const rows: RankRow[] = RIVALS.map((r) => ({ ...r, self: false }));
  if (state.org) {
    rows.push({ name: state.org.name, mcap: marketCap(state), hash: state.hash, self: true });
  } else {
    rows.push({ name: "—", mcap: state.usd, hash: state.hash, self: true, dissolved: true });
  }
  return rows;
}

function finish(rows: RankRow[], pick: (r: RankRow) => number): Board {
  const sorted = [...rows].sort((a, b) => pick(b) - pick(a));
  return { rows: sorted, myRank: sorted.findIndex((r) => r.self) + 1 };
}

/** USD 世界排名：按公司市值降序 */
export function buildUsdBoard(state: GameState): Board {
  return finish(rankRows(state), (r) => r.mcap);
}

/** HASH 世界排名：按 HASH 余额降序 */
export function buildHashBoard(state: GameState): Board {
  return finish(rankRows(state), (r) => r.hash);
}

/** 离线收益：按真实经过秒数结算（最多 OFFLINE_CAP_SEC） */
export function calcOfflineGain(state: GameState): { usd: number; hash: number } {
  if (!state.org) return { usd: 0, hash: 0 };
  const sec = Math.min((Date.now() - state.lastSave) / 1000, OFFLINE_CAP_SEC);
  if (sec <= 0) return { usd: 0, hash: 0 };
  const usd = state.usd * annualYield(state) * (sec / SEC_PER_YEAR);
  const hash = state.capacity * HASH_PASSIVE_SCALE * sec;
  return { usd: Math.floor(usd * 1e6) / 1e6, hash: Math.floor(hash) };
}

/** 数值字段兜底：非有限数字 → 0（旧存档/脏数据不许带 NaN 进 reducer） */
function finiteOrZero(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function numberMap(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) out[k] = finiteOrZero(n);
  return out;
}

function fundingMap(v: unknown): Record<string, { total: number; fromGrants: number }> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, { total: number; fromGrants: number }> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    const f = (raw ?? {}) as { total?: unknown; fromGrants?: unknown };
    const total = Math.max(0, finiteOrZero(f.total));
    const fromGrants = Math.max(0, Math.min(finiteOrZero(f.fromGrants), total));
    if (total > 0) out[k] = { total, fromGrants };
  }
  return out;
}

function giftList(v: unknown): GiftBox[] {
  if (!Array.isArray(v)) return [];
  const out: GiftBox[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const g = raw as Partial<GiftBox>;
    if (typeof g.id !== "string" || g.id === "") continue;
    const gift: GiftBox = {
      id: g.id,
      opened: !!g.opened,
      at: Number.isFinite(g.at as number) ? (g.at as number) : Date.now(),
    };
    if (typeof g.from === "string") gift.from = g.from;
    out.push(gift);
  }
  return out;
}

/** 载入修复：补齐缺失字段，并自动结算卡死在投票态的历史表决 */
export function repairState(state: GameState): GameState {
  const s: GameState = {
    ...state,
    dividends: state.dividends ?? 0,
    companyRep: state.companyRep ?? { ...COMPANY_REP_INIT },
    donations: state.donations ?? (state as { shop?: Record<string, number> }).shop ?? {},
    purchases: state.purchases ?? {},
    items: state.items ?? {},
    wallets: state.wallets ?? Object.fromEntries(state.members.map((m) => [m.id, 0])),
    // P1b 新字段：gpu-king-v8 等旧存档没有这四项，补默认值（绝不抛错）
    grants: numberMap(state.grants),
    lockedWallets: numberMap(state.lockedWallets),
    gifts: giftList(state.gifts),
    funding: fundingMap(state.funding),
    org: state.org
      ? { name: state.org.name || DEFAULT_COMPANY_NAME, members: state.org.members }
      : state.org,
    log: (state.log ?? []).filter((l) => typeof l.k === "string"),
  };
  const p = s.proposal;
  if (!p || p.phase !== "voting" || !s.org) return s;
  const electorate = activeMembers(s).filter((id) => id !== kickTargetId(p));
  if (Object.keys(p.ballots).some((id) => !electorate.includes(id))) {
    const ballots: Record<string, boolean> = {};
    let yes = 0;
    let no = 0;
    for (const [id, v] of Object.entries(p.ballots)) {
      if (electorate.includes(id)) {
        ballots[id] = v;
        v ? yes++ : no++;
      }
    }
    s.proposal = { ...p, ballots, yes, no };
  }
  const cur = s.proposal!;
  if (electorate.length === 0) return { ...s, proposal: null };
  if (electorate.every((id) => id in cur.ballots)) {
    return resolveProposal(s);
  }
  return s;
}
