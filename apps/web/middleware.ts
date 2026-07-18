import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/production-pipeline" || request.nextUrl.pathname === "/production-pipeline/index.html") {
    return NextResponse.redirect(new URL("/home/production-pipeline", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/production-pipeline", "/production-pipeline/index.html"]
};
