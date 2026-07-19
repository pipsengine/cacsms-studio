import { NextResponse } from "next/server";
import type { Permission } from "@/lib/auth/rbac";
import { requirePermission } from "@/lib/auth/rbac";
import { getRequestSession } from "@/lib/auth/session";

export function isInternalAutonomyRequest(request: Request): boolean {
  const internalToken = process.env.CACSMS_INTERNAL_AUTONOMY_TOKEN;
  return Boolean(internalToken) && request.headers.get("x-cacsms-internal") === internalToken;
}

function isSameOriginMutation(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin === requestOrigin) return true;
  if (referer?.startsWith(`${requestOrigin}/`)) return true;
  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;
  return false;
}

export async function requireMutationAccess(
  request: Request,
  permission: Permission = "production.write"
): Promise<NextResponse | null> {
  if (isInternalAutonomyRequest(request)) {
    return null;
  }

  if (!isSameOriginMutation(request)) {
    return NextResponse.json(
      { message: "Write access requires a same-origin studio session." },
      { status: 403 }
    );
  }

  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json(
      { message: "Authentication required. Reload the studio to bootstrap a session." },
      { status: 401 }
    );
  }

  const error = requirePermission(session, permission);
  if (error) {
    return NextResponse.json({ message: error }, { status: 403 });
  }

  return null;
}

/** @deprecated Use requireMutationAccess(request, permission) instead */
export async function requireAuthenticatedMutation(request: Request, permission: Permission) {
  return requireMutationAccess(request, permission);
}
