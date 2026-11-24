import { ImageResponse } from "next/og";

/**
 * Icono de la pestaña en PNG (64 px), para navegadores que no usan el SVG.
 * Se genera a partir del logotipo (src/app/icon.svg) porque Safari no usa
 * iconos SVG en todas partes.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

const LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+CiAgPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iOSIgZmlsbD0iIzQzMzhjYSIvPgogIDxwYXRoIGQ9Ik0yMi4wOCA5LjkyQTguNiA4LjYgMCAxIDEgMTMuNzcgNy42OSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTE2LjY3IDYuOTJMMTMuMTggNS40N0wxNC4zNyA5LjkxWiIgZmlsbD0iI2ZmZiIvPgogIDxwYXRoIGQ9Ik0xMi40IDE5LjJWMTMuMkwxNiAxNi45TDE5LjYgMTMuMlYxOS4yIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMi4yIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+";

export default function Icon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- ImageResponse no admite next/image
      <img src={LOGO} width={size.width} height={size.height} alt="" />
    ),
    size,
  );
}
