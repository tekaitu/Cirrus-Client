import { ChatIcon, CodeIcon, CubeIcon } from "./Icons";

/**
 * Official logos live as files in src/assets/brand/ (see the README there). Nothing is drawn by hand.
 * discord.svg and github.svg are single-colour and take the text colour; microsoft.svg and minecraft.svg are
 * the companies' own files and are shown as they are. The Minecraft wordmark is wide, so it keeps its aspect
 * ratio instead of being forced into a square.
 */
const FILES = import.meta.glob("../assets/brand/*.{svg,png,webp}", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

export type BrandName = "discord" | "github" | "microsoft" | "minecraft";

function fileFor(name: BrandName): string | null {
  const key = Object.keys(FILES).find((k) => new RegExp(`/${name}\\.(svg|png|webp)$`).test(k));
  return key ? FILES[key] : null;
}

/** The brand's own logo when its file is present, otherwise a neutral icon (or nothing for Microsoft). */
export function BrandIcon({ name, size = 18 }: { name: BrandName; size?: number }) {
  const url = fileFor(name);
  if (!url) {
    if (name === "discord") return <ChatIcon />;
    if (name === "github") return <CodeIcon />;
    if (name === "minecraft") return <CubeIcon />;
    return null;
  }
  if (name === "minecraft") {
    return (
      <img
        className="brand-icon brand-icon-wordmark"
        src={url}
        alt="Minecraft"
        height={size}
        style={{ height: size, width: "auto" }}
        draggable={false}
      />
    );
  }
  if (name === "microsoft") {
    return <img className="brand-icon brand-icon-colour" src={url} alt="" aria-hidden="true" width={size} height={size} />;
  }
  return (
    <span
      className="brand-icon"
      aria-hidden="true"
      style={{ width: size, height: size, WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")` }}
    />
  );
}
