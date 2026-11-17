import { CATEGORIES, type CategoryId } from "@/lib/catalog";
import { HUE_CLASSES } from "./tones";

/** Monograma del servicio sobre el tono de su categoría (sin logotipos de marcas). */
export function ServiceMark({ name, category, size = "md" }: { name: string; category: CategoryId; size?: "md" | "lg" }) {
  const sizes = size === "lg" ? "size-12 rounded-inner text-section" : "size-9 rounded-[10px] text-small";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex flex-none items-center justify-center font-semibold ${sizes} ${HUE_CLASSES[CATEGORIES[category].hue]}`}
    >
      {name.charAt(0)}
    </span>
  );
}
