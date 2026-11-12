import { NextResponse } from "next/server";

/**
 * Route 级强制动态执行：每次请求都跑 GET，避免构建期把汇率静态化。
 * 若构建时两个源都失败，静态化会缓存 503 长达 1 小时，故必须 force-dynamic。
 * 上游仍靠 fetch 级 next.revalidate 走 data cache（1 小时内不重复打上游）。
 */
export const dynamic = "force-dynamic";

/** 成功响应：允许 CDN/边缘短缓存 + SWR；错误响应见下方 no-store */
const OK_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=3600";

const FX_TIMEOUT_MS = 5000;

interface FxPayload {
  base: "USD";
  rates: { CNY: number; HKD: number };
  date: string;
  source: string;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FX_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** 主源：ECB 参考汇率（frankfurter），免费无 key */
async function fromFrankfurter(): Promise<FxPayload> {
  const data = (await fetchJson(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY,HKD",
  )) as { date?: unknown; rates?: { CNY?: unknown; HKD?: unknown } };
  const cny = data?.rates?.CNY;
  const hkd = data?.rates?.HKD;
  if (typeof cny !== "number" || typeof hkd !== "number" || typeof data?.date !== "string") {
    throw new Error("bad_frankfurter_shape");
  }
  return { base: "USD", rates: { CNY: cny, HKD: hkd }, date: data.date, source: "frankfurter" };
}

/** 备源：er-api（主源失败/结构异常时启用） */
async function fromErApi(): Promise<FxPayload> {
  const data = (await fetchJson("https://open.er-api.com/v6/latest/USD")) as {
    result?: unknown;
    time_last_update_utc?: unknown;
    rates?: { CNY?: unknown; HKD?: unknown };
  };
  const cny = data?.rates?.CNY;
  const hkd = data?.rates?.HKD;
  if (
    data?.result !== "success" ||
    typeof cny !== "number" ||
    typeof hkd !== "number" ||
    typeof data?.time_last_update_utc !== "string"
  ) {
    throw new Error("bad_erapi_shape");
  }
  return {
    base: "USD",
    rates: { CNY: cny, HKD: hkd },
    date: data.time_last_update_utc,
    source: "er-api",
  };
}

/** GET /api/fx：USD→CNY/HKD 实时汇率；两源皆败返回 503（绝不伪造汇率） */
export async function GET() {
  try {
    return NextResponse.json(await fromFrankfurter(), {
      headers: { "cache-control": OK_CACHE_CONTROL },
    });
  } catch {
    // 主源失败 → 走备源
  }
  try {
    return NextResponse.json(await fromErApi(), {
      headers: { "cache-control": OK_CACHE_CONTROL },
    });
  } catch {
    // 两源皆失败
  }
  // 错误绝不缓存：no-store，避免 503 被边缘/浏览器复用
  return NextResponse.json(
    { error: "fx_unavailable" },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
