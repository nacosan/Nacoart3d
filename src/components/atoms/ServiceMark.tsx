import { brandFor } from "@/lib/brand-icons";
import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { HUE_CLASSES } from "@/components/atoms/tones";

const SIZES = {
  md: { box: "size-9 rounded-[10px]", icon: 18, text: "text-small" },
  lg: { box: "size-12 rounded-inner", icon: 26, text: "text-section" },
} as const;

/**
 * Logotipo del servicio en su color de marca, sobre una tarjeta clara. Si no
 * hay logotipo para ese nombre, la inicial sobre el tono de su categoría.
 * Decorativo: el nombre del servicio siempre aparece al lado en texto.
 */
export function ServiceMark({ name, category, size = "md" }: { name: string; category: CategoryId; size?: "md" | "lg" }) {
  const brand = brandFor(name);
  const dims = SIZES[size];
  if (brand) {
    return (
      <span aria-hidden="true" className={`inline-flex flex-none items-center justify-center border border-border bg-white ${dims.box}`}>
        <svg viewBox="0 0 24 24" width={dims.icon} height={dims.icon} fill={`#${brand.hex}`} className="block">
          <path d={brand.path} />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center font-semibold ${dims.box} ${dims.text} ${HUE_CLASSES[CATEGORIES[category].hue]}`}
    >
      {name.charAt(0)}
    </span>
  );
}
