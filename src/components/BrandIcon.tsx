import { ChatIcon, CodeIcon } from "./Icons";

/** Official logos the owner drops into src/assets/brand/ (see the README there). Nothing is drawn by hand. */
const FILES = import.meta.glob("../assets/brand/*.svg", { eager: true, query: "?url", import: "default" }) as Record<
  string,
  string
>;

export type BrandName = "discord" | "github";

function fileFor(name: BrandName): string | null {
  const key = Object.keys(FILES).find((k) => k.endsWith(`/${name}.svg`));
  return key ? FILES[key] : null;
}

/** The brand's own logo when its file is present, otherwise a neutral icon. */
export function BrandIcon({ name, size = 18 }: { name: BrandName; size?: number }) {
  const url = fileFor(name);
  if (!url) return name === "discord" ? <ChatIcon /> : <CodeIcon />;
  return (
    <span
      className="brand-icon"
      aria-hidden="true"
      style={{ width: size, height: size, WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` }}
    />
  );
}
