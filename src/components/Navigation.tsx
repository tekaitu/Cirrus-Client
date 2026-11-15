import {
  DiagnosticsIcon,
  HomeIcon,
  CloseIcon,
  InfoIcon,
  MaximizeIcon,
  MinimizeIcon,
  ModsIcon,
  PlayArrowIcon,
  RefreshIcon,
  SettingsIcon,
  ShirtIcon,
  UserIcon,
} from "./Icons";
import { BrandIcon } from "./BrandIcon";
import { LogoMark } from "./Logo";
import { SkinHead } from "./SkinHead";
import { useCustomFrame, windowActions } from "../core/windowFrame";

export type PageId = "home" | "play" | "mods" | "skins" | "accounts" | "settings" | "about" | "diagnostics";

export const PAGE_TITLES: Record<PageId, string> = {
  home: "Home",
  play: "Play",
  mods: "Mods",
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
  { id: "play", icon: <PlayArrowIcon /> },
  { id: "mods", icon: <ModsIcon /> },
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

function nameFor(id: PageId): string {
  return id === "play" ? "Play page" : PAGE_TITLES[id];
}

/** Premium Cirrus navigation. Keeps the original navigation and Tauri actions intact. */
export function TopNav({
  page,
  onNavigate,
  onAccount,
  onRescan,
  scanning,
  accountOpen,
  player,
  discord,
}: Props) {
  const customFrame = useCustomFrame();

  return (
    <header className="topnav cirrus-topnav" data-tauri-drag-region>
      <button
        type="button"
        className="brand cirrus-brand"
        data-tauri-drag-region
        onClick={() => onNavigate("home")}
        aria-label="Cirrus Client home"
      >
        <span className="brand-mark cirrus-brand-mark" aria-hidden="true">
          <LogoMark size={31} />
        </span>
        <span className="cirrus-brand-copy" aria-hidden="true">
          <span className="brand-name">CIRRUS <b>CLIENT</b></span>
          <span className="cirrus-brand-caption">MINECRAFT, REIMAGINED</span>
        </span>
      </button>

      <nav aria-label="Main" className="tabs cirrus-tabs" data-tauri-drag-region>
        <ul>
          {TABS.map((item) => {
            const active = page === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`tab cirrus-tab ${active ? "active" : ""}`}
                  aria-label={nameFor(item.id)}
                  data-tip={PAGE_TITLES[item.id]}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="cirrus-tab-icon" aria-hidden="true">{item.icon}</span>
                  <span className="tab-label">{PAGE_TITLES[item.id]}</span>
                  {active && <span className="cirrus-tab-indicator" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="topnav-right cirrus-nav-right" data-tauri-drag-region>
        <nav aria-label="Tools" className="tools cirrus-tools">
          <ul>
            {TOOLS.map((item) => {
              const active = page === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`tool cirrus-tool ${active ? "active" : ""}`}
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
                  className={`tool tool-presence cirrus-tool ${discord.enabled ? "tool-on" : ""}`}
                  aria-label="Discord Presence"
                  aria-pressed={discord.enabled}
                  data-tip={discord.enabled ? "Discord status on" : "Discord status off"}
                  title={discord.enabled
                    ? "Your Discord status shows what you are doing. Click to turn off."
                    : "Discord status is off. Click to turn on."}
                  onClick={discord.onToggle}
                >
                  <BrandIcon name="discord" />
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                className="tool cirrus-tool cirrus-rescan"
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
          className="account-chip cirrus-account-chip"
          aria-label="Account"
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
          onClick={onAccount}
        >
          <span className="cirrus-account-avatar">
            <SkinHead uuid={player?.id ?? null} name={player?.name ?? null} size={34} />
          </span>
          <span className="account-chip-text">
            <small>{player ? "SIGNED IN AS" : "YOUR PROFILE"}</small>
            <strong>{player ? player.name : "Guest account"}</strong>
          </span>
          <span className="cirrus-account-chevron" aria-hidden="true">⌄</span>
        </button>

        {customFrame && (
          <div className="winctl cirrus-winctl" role="group" aria-label="Window">
            <button type="button" aria-label="Minimize window" onClick={windowActions.minimize}>
              <MinimizeIcon />
            </button>
            <button type="button" aria-label="Maximize or restore window" onClick={windowActions.toggleMaximize}>
              <MaximizeIcon />
            </button>
            <button type="button" className="winctl-close" aria-label="Close window" onClick={windowActions.close}>
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
