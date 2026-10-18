import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16: `proxy.ts` reemplaza a `middleware.ts`. Solo es una primera
 * barrera de UX (¿hay cookie?): la autorización real la hace la API en cada
 * petición, leyendo la sesión de la base de datos.
 */
const SESSION_COOKIE = "folio_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/app") && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/registro") && hasSession) {
    return NextResponse.redirect(new URL("/app", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/registro"],
};
