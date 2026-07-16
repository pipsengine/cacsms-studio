import { NextResponse } from "next/server";

export function requireReadAccess(request: Request) {
  const internalToken = process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;
  const internal =
    Boolean(internalToken) && request.headers.get("x-cacsms-internal") === internalToken;

  if (internal) {
    return null;
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin === requestOrigin) {
    return null;
  }

  if (referer?.startsWith(`${requestOrigin}/`)) {
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
