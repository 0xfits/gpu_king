import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * P1a 签名会话（HMAC-SHA256，node:crypto 自签，零新依赖）。
 *
 * Cookie 值格式：`<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`
 *   - payload 内含 iat/exp（秒级 Unix 时间戳）
 *   - MAC 覆盖 base64url(JSON) 整段字符串（即「签名的是编码后的原文」）
 *   - 校验用 crypto.timingSafeEqual 比较，过期/篡改/格式错一律返回 null
 *
 * 密钥：只从 process.env.AUTH_SECRET 读；缺失时**抛 AuthConfigError**，
 * 绝不静默退化成空密钥（空密钥等于没有签名）。
 */

/** 会话 cookie 名 */
export const SESSION_COOKIE = "gk_session";
/** OAuth 临时 cookie 名（存签名过的 state + invite，10 分钟） */
export const OAUTH_COOKIE = "gk_oauth";

/** 默认会话时长：30 天 */
export const DEFAULT_SESSION_TTL_SEC = 30 * 86400;
/** OAuth state 临时 cookie 时长：10 分钟 */
export const OAUTH_TTL_SEC = 600;

/** 配置缺失（AUTH_SECRET 等）——路由捕获后映射成 503，不当 500 抛 */
export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

function readSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) {
    throw new AuthConfigError(
      "AUTH_SECRET 未配置：请在 .env.local 写入 64 位随机十六进制密钥（键名 AUTH_SECRET，权限 600）。",
    );
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input as never).toString("base64url");
}

/** HMAC-SHA256 → base64url；缺密钥时抛 AuthConfigError */
function mac(base64urlPayload: string): string {
  return createHmac("sha256", readSecret()).update(base64urlPayload, "utf8").digest("base64url");
}

function signPayload(body: Record<string, unknown>): string {
  const json = JSON.stringify(body);
  return `${b64url(Buffer.from(json, "utf8"))}.${mac(b64url(Buffer.from(json, "utf8")))}`;
}

/**
 * 签发会话值。
 * @param payload 至少含 uid；name/avatar 可选（只作展示兜底，权威数据以库为准）
 * @param ttlSec  有效期秒数，默认 30 天
 */
export function signSession(
  payload: { uid: string; name?: string; avatar?: string },
  ttlSec: number = DEFAULT_SESSION_TTL_SEC,
): string {
  if (!payload || typeof payload.uid !== "string" || payload.uid === "") {
    throw new Error("signSession: payload.uid 必须是非空字符串");
  }
  const iat = Math.floor(Date.now() / 1000);
  const body: Record<string, unknown> = { ...payload, iat, exp: iat + Math.floor(ttlSec) };
  if (typeof payload.name === "string") body.name = payload.name;
  if (typeof payload.avatar === "string") body.avatar = payload.avatar;
  return signPayload(body);
}

export interface SessionPayload {
  uid: string;
  name?: string;
  avatar?: string;
  exp: number;
}

/**
 * 校验会话值。签名不合法 / 格式错 / 已过期 → null（不区分原因，避免给攻击者反馈）。
 * AUTH_SECRET 缺失 → 抛 AuthConfigError。
 */
export function verifySession(value: string | null | undefined): SessionPayload | null {
  const body = verifySigned(value);
  if (!body) return null;
  const uid = body.uid;
  if (typeof uid !== "string" || uid === "") return null;
  const exp = body.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;
  const out: SessionPayload = { uid, exp };
  if (typeof body.name === "string") out.name = body.name;
  if (typeof body.avatar === "string") out.avatar = body.avatar;
  return out;
}

/** 签发 OAuth 临时 state（login → callback 之间的一次性凭证，带可选 invite slug） */
export function signState(
  payload: { state: string; invite?: string },
  ttlSec: number = OAUTH_TTL_SEC,
): string {
  if (!payload || typeof payload.state !== "string" || payload.state === "") {
    throw new Error("signState: payload.state 必须是非空字符串");
  }
  const iat = Math.floor(Date.now() / 1000);
  const body: Record<string, unknown> = { ...payload, iat, exp: iat + Math.floor(ttlSec) };
  if (typeof payload.invite === "string") body.invite = payload.invite;
  return signPayload(body);
}

export interface StatePayload {
  state: string;
  invite?: string;
  exp: number;
}

/** 校验 OAuth 临时 state；无效/过期 → null */
export function verifyState(value: string | null | undefined): StatePayload | null {
  const body = verifySigned(value);
  if (!body) return null;
  const state = body.state;
  if (typeof state !== "string" || state === "") return null;
  const exp = body.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  const out: StatePayload = { state, exp };
  if (typeof body.invite === "string") out.invite = body.invite;
  return out;
}

/** 签名 → 校验 的公共内核：返回解析后的 payload（未含过期判定），失败 null */
function verifySigned(value: string | null | undefined): Record<string, unknown> | null {
  if (typeof value !== "string" || value === "") return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1 || value.indexOf(".", dot + 1) !== -1) return null;
  const encoded = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }

  // 先算期望签名（缺 AUTH_SECRET 在这里抛 AuthConfigError，向上冒泡）
  const expected = mac(encoded);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null; // 长度本身不是秘密（MAC 定长）
  if (!timingSafeEqual(a, b)) return null;

  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 会话 cookie 的安全参数。
 * - httpOnly：JS 读不到，防 XSS 偷 cookie
 * - sameSite=lax：跨站 GET 顶层导航（OAuth 回跳）不带，POST 不带，防 CSRF
 * - secure：生产 HTTPS 才带（本地 http 不带，否则浏览器直接丢弃）
 * - path=/：全站生效
 */
export function sessionCookieOptions(maxAge: number): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** 解析请求头 Cookie（服务端自解析，不依赖 next/headers，便于直接用 curl 测） */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const k = part.slice(0, eq).trim();
    if (!k || k in out) continue;
    out[k] = part.slice(eq + 1).trim();
  }
  return out;
}

/** 定长字符串的常量时间比较（比 state 用；长度不等直接 false） */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length || x.length === 0) return false;
  return timingSafeEqual(x, y);
}
