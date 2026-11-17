import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);

  // Aquí irá la protección de rutas cuando exista login. Ejemplo:
  // if (!claims && request.nextUrl.pathname.startsWith("/privado")) {
  //   return withSupabaseCookies(
  //     NextResponse.redirect(new URL("/login", request.url)),
  //     response,
  //   );
  // }

  return response;
}

export const config = {
  matcher: [
    // Todo excepto recursos estáticos, optimización de imágenes, favicon e imágenes/fuentes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
