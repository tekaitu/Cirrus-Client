import { ART, type ArtId } from "../core/art";
import { useTheme } from "../hooks/useTheme";

/** Pictures the owner can add (their own screenshots): src/assets/backgrounds/home.jpg, default.jpg, ... */
const OWN = import.meta.glob("../assets/backgrounds/*.{jpg,jpeg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function ownPicture(name: string): string | null {
  const key = Object.keys(OWN).find((k) => new RegExp(`/${name}\\.(jpe?g|png|webp)$`).test(k));
  return key ? OWN[key] : null;
}

export type BackdropId = "home" | "library" | "browse" | "night";

const BACKDROP: Record<BackdropId, ArtId> = {
  home: "summer",
  library: "trials",
  browse: "wilderness",
  night: "wilderness",
};

/**
 * The picture behind the whole window. It changes with the page and fades between pages.
 *
 * Colorful keeps the bright Minecraft key art (the cube landscape); Classic holds
 * the same pictures back to near-monochrome. A `-colorful` picture the owner adds
 * to src/assets/backgrounds is used first when Colorful is selected.
 */
export function AppBackground({ id }: { id: BackdropId }) {
  const theme = useTheme();
  const colorful = theme === "colorful";
  const src =
    (colorful ? ownPicture(`${id}-colorful`) ?? ownPicture("default-colorful") : null) ??
    ownPicture(id) ??
    ownPicture("default") ??
    ART[BACKDROP[id]].full;
  return (
    <div className="app-bg" data-backdrop={id} data-art={colorful ? "colorful" : "classic"} aria-hidden="true">
      <div key={id} className="app-bg-layer">
        <img className="app-bg-img" src={src} alt="" decoding="async" />
      </div>
      <div className="app-bg-veil" />
      <div className="app-bg-vignette" />
    </div>
  );
}
