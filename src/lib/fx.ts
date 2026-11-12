"use client";

import { useEffect, useState } from "react";

/** 汇率数据（USD → CNY / HKD） */
export interface FxData {
  rates: { CNY: number; HKD: number };
  /** 数据日期（主源为 ECB 日期；备源为更新时间 UTC 串） */
  date: string;
  /** 数据来源：frankfurter / er-api / fallback */
  source: string;
  loading: boolean;
  /** 失败原因（离线兜底时非 null） */
  error: string | null;
  /** true = 走了内置兜底值，UI 必须标注离线 */
  offline: boolean;
}

/**
 * 仅断网兜底，UI 必须标注离线（shop.topup.fxOffline）。
 * 绝不作为真实汇率展示，也不写入日志口径——日志记的是本次实际使用的 rate。
 */
export const FALLBACK_RATES = { CNY: 7.1, HKD: 7.8 };

/** 汇率换算：面值（当地货币）÷ 汇率 = 应付 USD，保 6 位（匹配余额浮点精度） */
export function usdCostOf(amount: number, rate: number): number {
  return Math.round((amount / rate) * 1e6) / 1e6;
}

/**
 * 拉取 /api/fx（4s 超时）。失败时回落 FALLBACK_RATES 并置 offline=true。
 * 注意：兜底值仅供 UI 展示且必须标注「離線匯率」，不做任何真实计价承诺。
 */
export function useFxRates(): FxData {
  const [fx, setFx] = useState<FxData>({
    rates: FALLBACK_RATES,
    date: "",
    source: "",
    loading: true,
    error: null,
    offline: false,
  });

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);

    fetch("/api/fx", { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { rates?: { CNY?: number; HKD?: number }; date?: string; source?: string }) => {
        if (cancelled) return;
        const cny = data?.rates?.CNY;
        const hkd = data?.rates?.HKD;
        if (typeof cny !== "number" || typeof hkd !== "number") throw new Error("bad_fx_shape");
        setFx({
          rates: { CNY: cny, HKD: hkd },
          date: data.date ?? "",
          source: data.source ?? "",
          loading: false,
          error: null,
          offline: false,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFx({
          rates: FALLBACK_RATES,
          date: "",
          source: "fallback",
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          offline: true,
        });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  return fx;
}
