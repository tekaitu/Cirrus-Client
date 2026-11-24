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
 * Colorful uses the owner's Minecraft background from
 * src/assets/backgrounds/colorful.jpg (or .png/.webp) on every page; Classic
 * holds its own pictures back to near-monochrome.
 */
export function AppBackground({ id }: { id: BackdropId }) {
  const theme = useTheme();
  const colorful = theme === "colorful";
  // One supplied Minecraft picture fills the window on every page. The older
  // `default-colorful` / per-page names still work for anyone who used them.
  const colorfulSrc =
    ownPicture("colorful") ??
    ownPicture("default-colorful") ??
    ownPicture(`${id}-colorful`) ??
    ownPicture("home-colorful");
  const src =
    (colorful ? colorfulSrc : null) ??
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
      <div className="app-bg-ember" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
