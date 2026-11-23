import type { InstanceView } from "../api/types";
import { Button } from "./Button";
import { FolderIcon, ModsIcon, PlayArrowIcon, SettingsIcon } from "./Icons";
import { VersionArt } from "./VersionCard";
import { lastPlayedText } from "../core/instances";
import { readInstanceIcon } from "../core/instanceIcons";

function loaderLine(instance: InstanceView) {
  if (instance.loader === "fabric") {
    const version = instance.loaderVersion ? `LOADER ${instance.loaderVersion}` : "LOADER";
    const mods = instance.modCount > 0 ? ` · ${instance.modCount} ${instance.modCount === 1 ? "mod" : "mods"}` : "";
    return `${version}${mods}`;
  }
  return "Vanilla";
}

/**
 * An installed instance as the older Maple card: full-bleed Minecraft art, the
 * version and loader as the title, the instance name and loader line beneath,
 * then Launch (and Mods for Fabric) along the bottom.
 *
 * Selecting the card selects the instance; the buttons act on this card only.
 */
export function InstanceCard({
  instance,
  selected,
  onSelect,
  onLaunch,
  onMods,
  onSettings,
  onFolder,
  launchDisabled = false,
  launchTitle,
}: {
  instance: InstanceView;
  selected: boolean;
  onSelect: () => void;
  onLaunch: () => void;
  onMods?: () => void;
  onSettings?: () => void;
  onFolder?: () => void;
  launchDisabled?: boolean;
  launchTitle?: string;
}) {
  const title = `${instance.minecraft} ${instance.loader === "fabric" ? "Fabric" : "Vanilla"}`;
  // A picture chosen for this instance wins over the Minecraft family art.
  const photo = readInstanceIcon(instance.id);
  return (
    <article className={`ic ${selected ? "ic-selected" : ""}`} aria-label={instance.name}>
      <button
        type="button"
        className="ic-main"
        aria-pressed={selected}
        aria-label={`Select ${instance.name}`}
        onClick={onSelect}
      >
        {photo ? (
          <img className="ic-art ic-photo" src={photo} alt="" aria-hidden="true" />
        ) : (
          <VersionArt version={instance.minecraft} extra={instance.loader} className="ic-art" />
        )}
        <span className="ic-shade" aria-hidden="true" />
        {selected && <span className="ic-badge">Selected</span>}
        <span className="ic-text">
          <h2 className="ic-name">{instance.name}</h2>
          <span className="ic-title">{title}</span>
          <span className="ic-meta">{loaderLine(instance)}</span>
          <span className="ic-last">{lastPlayedText(instance.lastPlayed)}</span>
        </span>
      </button>
      <div className="ic-actions">
        <Button variant="primary" size="md" onClick={onLaunch} disabled={launchDisabled} title={launchTitle}>
          <PlayArrowIcon /> Launch
        </Button>
        {instance.loader === "fabric" && onMods && (
          <Button variant="secondary" size="md" onClick={onMods} title={`Manage mods for ${instance.name}`}>
            <ModsIcon /> Mods
          </Button>
        )}
        <span className="ic-tools">
          {onSettings && (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Settings for ${instance.name}`}
              data-tip="Instance settings"
              onClick={onSettings}
            >
              <SettingsIcon />
            </button>
          )}
          {onFolder && (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Open folder for ${instance.name}`}
              data-tip="Open folder"
              onClick={onFolder}
            >
              <FolderIcon />
            </button>
          )}
        </span>
      </div>
    </article>
  );
}
