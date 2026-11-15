import {
  ChatIcon,
  DiagnosticsIcon,
  HomeIcon,
  InfoIcon,
  ModsIcon,
  PlayArrowIcon,
  RefreshIcon,
  SettingsIcon,
  ShirtIcon,
  UserIcon,
} from "./Icons";
import { LogoMark } from "./Logo";
import { SkinHead } from "./SkinHead";

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
  /** The signed-in player, or null. */
  player: { name: string; id: string } | null;
  /** Discord Presence switch. */
  discord?: { enabled: boolean; onToggle: () => void };
}

/** "Play" alone would clash with the big Play button, so the page button says "Play page". */
function nameFor(id: PageId): string {
  return id === "play" ? "Play page" : PAGE_TITLES[id];
}

/**
 * The bar across the top: brand, the pages you use to play, then settings and the account.
 * Below 900px wide the tab labels fold away and the icons stay (labels remain as tooltips and screen-reader names).
 */
export function TopNav({ page, onNavigate, onAccount, onRescan, scanning, accountOpen, player, discord }: Props) {
  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand-mark">
          <LogoMark size={28} />
        </span>
        <span className="brand-name" aria-hidden="true">
          CIRRUS <b>CLIENT</b>
        </span>
      </div>

      <nav aria-label="Main" className="tabs">
        <ul>
          {TABS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`tab ${page === item.id ? "active" : ""}`}
                aria-label={nameFor(item.id)}
                data-tip={PAGE_TITLES[item.id]}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.icon}
                <span className="tab-label" aria-hidden="true">
                  {PAGE_TITLES[item.id]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="topnav-right">
        <nav aria-label="Tools" className="tools">
          <ul>
            {TOOLS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`tool ${page === item.id ? "active" : ""}`}
                  aria-label={PAGE_TITLES[item.id]}
                  data-tip={PAGE_TITLES[item.id]}
                  aria-current={page === item.id ? "page" : undefined}
                  onClick={() => onNavigate(item.id)}
                >
                  {item.icon}
                </button>
              </li>
            ))}
            {discord && (
              <li>
                <button
                  type="button"
                  className={`tool tool-presence ${discord.enabled ? "tool-on" : ""}`}
                  aria-label="Discord Presence"
                  aria-pressed={discord.enabled}
                  data-tip={discord.enabled ? "Discord status on" : "Discord status off"}
                  title={
                    discord.enabled
                      ? "Your Discord status shows what you are doing. Click to turn off."
                      : "Discord status is off. Click to turn on."
                  }
                  onClick={discord.onToggle}
                >
                  <ChatIcon />
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                className="tool"
                aria-label="Re-scan Java"
                data-tip="Re-scan Java"
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
          className="account-chip"
          aria-label="Account"
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
          onClick={onAccount}
        >
          <SkinHead uuid={player?.id ?? null} name={player?.name ?? null} size={34} />
          <span className="account-chip-text">
            <small>Account</small>
            <strong>{player ? player.name : "Guest"}</strong>
          </span>
        </button>
      </div>
    </header>
  );
}
