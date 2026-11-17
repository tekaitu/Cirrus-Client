import { ART, type ArtId } from "../core/art";

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

/** The picture behind the whole window. It changes with the page and fades between pages. */
export function AppBackground({ id }: { id: BackdropId }) {
  const src = ownPicture(id) ?? ownPicture("default") ?? ART[BACKDROP[id]].full;
  return (
    <div className="app-bg" data-backdrop={id} aria-hidden="true">
      <div key={id} className="app-bg-layer">
        <img className="app-bg-img" src={src} alt="" decoding="async" />
      </div>
      <div className="app-bg-veil" />
      <div className="app-bg-vignette" />
    </div>
  );
}
