import { NextResponse } from "next/server";
import {
  createSession,
  getRequestSession,
  readSessionToken,
  sessionCookieName
} from "@/lib/auth/session";
import { getMssqlPool } from "@/lib/database/mssql";

export const dynamic = "force-dynamic";

async function bootstrapSession(request: Request): Promise<{ token: string; session: import("@/lib/auth/session").StudioSession } | null> {
  const existing = readSessionToken(request);
  if (existing && (await getRequestSession(request))) {
    return null;
  }

  const pool = await getMssqlPool();
  const result = await pool.request().query<{ UserId: string }>(
    `SELECT TOP(1) CONVERT(nvarchar(36), UserId) UserId FROM cacsms.Users WHERE IsActive=1 ORDER BY CASE Role WHEN N'administrator' THEN 0 WHEN N'manager' THEN 1 ELSE 2 END, CreatedAt`
  );
  const userId = result.recordset[0]?.UserId;
  if (!userId) return null;

  const { token, session } = await createSession(userId);
  return { token, session };
}

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (session) {
      return NextResponse.json({ session });
    }

    const bootstrapped = await bootstrapSession(request);
    if (!bootstrapped) {
      return NextResponse.json({ session: null });
    }

    const response = NextResponse.json({ session: bootstrapped.session, bootstrapped: true });
    response.cookies.set(sessionCookieName(), bootstrapped.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    });
    return response;
  } catch (error) {
    console.error("auth.session.read.failed", error);
    return NextResponse.json({ session: null }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string };
    if (!body.userId) return NextResponse.json({ message: "userId is required." }, { status: 400 });
    const { token, session } = await createSession(body.userId);
    const response = NextResponse.json({ session });
    response.cookies.set(sessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12
    });
    return response;
  } catch (error) {
    console.error("auth.session.create.failed", error);
    return NextResponse.json({ message: "Unable to create session." }, { status: 500 });
  }
}
