/**
 * Discord OAuth2 路由共用的小工具（login / callback 共用）。
 * 只做纯函数：拼 origin、拼 authorize URL、校验 invite slug —— 无 IO、无副作用。
 */

/** invite slug 只允许 slug 字符集，杜绝把 query 原样拼进 Location 造成开放跳转 */
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function sanitizeInvite(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  return SLUG_RE.test(v) ? v : undefined;
}

/**
 * 从请求头解析站点 origin（用于拼 redirect_uri 与回调 Location）。
 * 优先 `x-forwarded-host` / `host` + `x-forwarded-proto`（Vercel 反代链路），
 * proto 缺失时回退到请求 URL 自身的协议（本地 http://127.0.0.1:5790）。
 */
export function resolveOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host")?.trim() || req.headers.get("host")?.trim();
  const fwdProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let proto = fwdProto || "";
  if (!proto) {
    try {
      proto = new URL(req.url).protocol.replace(":", "");
    } catch {
      proto = "https";
    }
  }
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return `${proto}://localhost`;
  }
}

/** Discord 授权页 URL（默认只申请 identify，只读身份） */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL("https://discord.com/oauth2/authorize");
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.state);
  return u.toString();
}
