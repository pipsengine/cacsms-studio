import { NextResponse } from "next/server";

export function requireReadAccess(request: Request) {
  const internalToken = process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;
  const internal =
    Boolean(internalToken) && request.headers.get("x-cacsms-internal") === internalToken;

  if (internal) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const publicPort = process.env.CACSMS_PUBLIC_PORT;
  const publicOrigins = publicPort
    ? new Set([
        `${requestUrl.protocol}//${requestUrl.hostname}:${publicPort}`,
        `${requestUrl.protocol}//localhost:${publicPort}`,
        `${requestUrl.protocol}//127.0.0.1:${publicPort}`
      ])
    : new Set<string>();
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin === requestOrigin || (origin && publicOrigins.has(origin))) {
    return null;
  }

  if (
    referer?.startsWith(`${requestOrigin}/`) ||
    (referer && [...publicOrigins].some((allowedOrigin) => referer.startsWith(`${allowedOrigin}/`)))
  ) {
    return null;
  }

  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return null;
  }

  return NextResponse.json(
    { message: "Read access requires a same-origin studio session." },
    { status: 403 }
  );
}
