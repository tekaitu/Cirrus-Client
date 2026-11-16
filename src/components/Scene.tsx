import { useEffect, useRef } from "react";
import { paintScene, seedFrom, type SceneKind } from "../core/scene";

/** jsdom (the test environment) has no canvas; the picture is purely decorative, so it is simply skipped there. */
const CAN_PAINT = typeof navigator === "undefined" || !/jsdom/i.test(navigator.userAgent);

/** A generated voxel landscape. `seed` can be any text; the same text always gives the same picture. */
export function SceneCanvas({
  kind,
  seed,
  width = 320,
  height = 180,
  className = "",
}: {
  kind: SceneKind;
  seed: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!CAN_PAINT) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    paintScene(ctx, width, height, kind, seedFrom(seed));
  }, [kind, seed, width, height]);
  return <canvas ref={ref} className={`scene-canvas ${className}`.trim()} width={width} height={height} aria-hidden="true" />;
}

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

const BACKDROP: Record<BackdropId, { kind: SceneKind; seed: string }> = {
  home: { kind: "meadow", seed: "cirrus-home" },
  library: { kind: "cherry", seed: "cirrus-library" },
  browse: { kind: "ocean", seed: "cirrus-browse" },
  night: { kind: "night", seed: "cirrus-night" },
};

/** The picture behind the whole window. It changes with the page and fades between pages. */
export function AppBackground({ id }: { id: BackdropId }) {
  const own = ownPicture(id) ?? ownPicture("default");
  const b = BACKDROP[id];
  return (
    <div className="app-bg" data-backdrop={id} aria-hidden="true">
      <div key={id} className="app-bg-layer">
        {own ? (
          <img className="app-bg-img" src={own} alt="" />
        ) : (
          <SceneCanvas kind={b.kind} seed={b.seed} width={480} height={270} className="app-bg-canvas" />
        )}
      </div>
      <div className="app-bg-veil" />
      <div className="app-bg-vignette" />
    </div>
  );
}
