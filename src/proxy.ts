import { NextResponse, type NextRequest } from "next/server";
import { publicUrl } from "@/lib/redirects";
import { updateSession, withSupabaseCookies } from "@/utils/supabase/proxy";

/** Rutas que no exigen sesión. */
const PUBLIC_PREFIXES = ["/acceso", "/registro", "/recuperar", "/auth/", "/prototipo"];
/** Con sesión no tiene sentido verlas: se vuelve al resumen. */
const GUEST_ONLY = ["/acceso", "/registro"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { response, claims } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!claims && !matches(pathname, PUBLIC_PREFIXES)) {
    const target = pathname === "/" ? "/acceso" : `/acceso?siguiente=${encodeURIComponent(`${pathname}${search}`)}`;
    return withSupabaseCookies(NextResponse.redirect(publicUrl(request, target)), response);
  }

  if (claims && matches(pathname, GUEST_ONLY)) {
    return withSupabaseCookies(NextResponse.redirect(publicUrl(request, "/")), response);
  }

  return response;
}

export const config = {
  matcher: [
    // Todo excepto recursos estáticos, optimización de imágenes, favicon e imágenes/fuentes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
