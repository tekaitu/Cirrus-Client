import {
  CloseIcon,
  CompassIcon,
  CubeIcon,
  DiagnosticsIcon,
  HomeIcon,
  InfoIcon,
  MaximizeIcon,
  MinimizeIcon,
  ModsIcon,
  PackageIcon,
  RefreshIcon,
  SettingsIcon,
  ShirtIcon,
  UserIcon,
} from "./Icons";
import { BrandIcon } from "./BrandIcon";
import { LogoMark } from "./Logo";
import { SkinHead } from "./SkinHead";
import { useCustomFrame, windowActions } from "../core/windowFrame";

export type PageId =
  | "home"
  | "versions"
  | "browse"
  | "mods"
  | "modpacks"
  | "skins"
  | "accounts"
  | "settings"
  | "about"
  | "diagnostics";

export const PAGE_TITLES: Record<PageId, string> = {
  home: "Home",
  versions: "Versions",
  browse: "Browse",
  mods: "Mods",
  modpacks: "Modpacks",
  skins: "Skins",
  accounts: "Accounts",
  settings: "Settings",
  about: "About",
  diagnostics: "Diagnostics",
};

interface Item {
  id: PageId;
  icon: JSX.Element;
}

const TABS: Item[] = [
  { id: "home", icon: <HomeIcon /> },
  { id: "versions", icon: <CubeIcon /> },
  { id: "browse", icon: <CompassIcon /> },
  { id: "mods", icon: <ModsIcon /> },
  { id: "modpacks", icon: <PackageIcon /> },
  { id: "skins", icon: <ShirtIcon /> },
  { id: "accounts", icon: <UserIcon /> },
];

const TOOLS: Item[] = [
  { id: "settings", icon: <SettingsIcon /> },
  { id: "about", icon: <InfoIcon /> },
  { id: "diagnostics", icon: <DiagnosticsIcon /> },
];

interface Props {
  page: PageId;
  onNavigate: (page: PageId) => void;
  onAccount: () => void;
  onRescan: () => void;
  scanning: boolean;
  accountOpen: boolean;
  player: { name: string; id: string } | null;
  discord?: { enabled: boolean; onToggle: () => void };
}

/** The top bar: brand, page tabs, tools, the player and (in the desktop app) the window buttons. */
export function TopNav({ page, onNavigate, onAccount, onRescan, scanning, accountOpen, player, discord }: Props) {
  const customFrame = useCustomFrame();

  return (
    <header className="hdr" data-tauri-drag-region>
      <button type="button" className="hdr-brand" data-tauri-drag-region onClick={() => onNavigate("home")} aria-label="Cirrus Client home">
        <LogoMark size={30} />
        <span className="hdr-brand-name" aria-hidden="true">
          CIRRUS
        </span>
      </button>

      <nav aria-label="Main" className="hdr-tabs" data-tauri-drag-region>
        <ul>
          {TABS.map((item) => {
            const active = page === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`hdr-tab ${active ? "active" : ""}`}
                  aria-label={PAGE_TITLES[item.id]}
                  data-tip={PAGE_TITLES[item.id]}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="hdr-tab-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="hdr-tab-label">{PAGE_TITLES[item.id]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="hdr-right" data-tauri-drag-region>
        <nav aria-label="Tools" className="hdr-tools">
          <ul>
            {TOOLS.map((item) => {
              const active = page === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`hdr-tool ${active ? "active" : ""}`}
                    aria-label={PAGE_TITLES[item.id]}
                    data-tip={PAGE_TITLES[item.id]}
                    aria-current={active ? "page" : undefined}
                    onClick={() => onNavigate(item.id)}
                  >
                    {item.icon}
                  </button>
                </li>
              );
            })}
            {discord && (
              <li>
                <button
                  type="button"
                  className={`hdr-tool ${discord.enabled ? "on" : ""}`}
                  aria-label="Discord Presence"
                  aria-pressed={discord.enabled}
                  data-tip={discord.enabled ? "Discord status on" : "Discord status off"}
                  onClick={discord.onToggle}
                >
                  <BrandIcon name="discord" />
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                className="hdr-tool"
                aria-label="Re-scan Java"
                data-tip={scanning ? "Scanning Java…" : "Re-scan Java"}
                onClick={onRescan}
                disabled={scanning}
              >
                <RefreshIcon />
              </button>
            </li>
          </ul>
        </nav>

        <button
          type="button"
          className="hdr-account"
          aria-label="Account"
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
          onClick={onAccount}
        >
          <SkinHead uuid={player?.id ?? null} name={player?.name ?? null} size={30} />
          <span className="hdr-account-text">
            <small>{player ? "Signed in" : "Not signed in"}</small>
            <strong>{player ? player.name : "Guest"}</strong>
          </span>
        </button>

        {customFrame && (
          <div className="hdr-win" role="group" aria-label="Window">
            <button type="button" aria-label="Minimize window" onClick={windowActions.minimize}>
              <MinimizeIcon />
            </button>
            <button type="button" aria-label="Maximize or restore window" onClick={windowActions.toggleMaximize}>
              <MaximizeIcon />
            </button>
            <button type="button" className="hdr-win-close" aria-label="Close window" onClick={windowActions.close}>
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
