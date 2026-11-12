import { NextResponse } from "next/server";

/**
 * API 统一响应壳：
 * 成功 { ok:true, ...data }；失败 { ok:false, error, msg }。
 * 错误响应绝不携带 SQL、堆栈或连接串（细节只进服务端日志）。
 */

export function ok(data: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { ok: true, ...data },
    { headers: { "cache-control": "no-store" } },
  );
}

export function fail(status: number, error: string, msg: string): NextResponse {
  return NextResponse.json(
    { ok: false, error, msg },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** 兜底 500：message 只写日志，响应体保持通用文案 */
export function internal(ctx: string, err: unknown): NextResponse {
  console.error(`[api:${ctx}]`, err instanceof Error ? err.message : err);
  return fail(500, "internal", "服务器内部错误，请稍后重试");
}

/** 解析 JSON body；非法 JSON 返回 null（调用方转 400） */
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
