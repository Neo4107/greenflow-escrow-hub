import { getRequest } from "@tanstack/react-start/server";

/**
 * Ensures a caller-supplied return URL points back to this app (same origin
 * as the incoming request). Throws on anything else to prevent open redirects.
 */
export function assertSameOriginReturnUrl(returnUrl: string): string {
  const target = new URL(returnUrl);
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error("Invalid return URL");
  }
  const request = getRequest();
  const allowed = new Set<string>();
  if (request?.url) allowed.add(new URL(request.url).origin);
  const originHeader = request?.headers.get("origin");
  if (originHeader) allowed.add(originHeader);
  const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  if (!allowed.has(target.origin)) throw new Error("Invalid return URL");
  return target.toString();
}
