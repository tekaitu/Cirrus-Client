import { useEffect, useState } from "react";
import { usernameError } from "../core/game";
import { usePlayAs } from "../hooks/usePlayAs";
import { Button } from "./Button";
import { UserIcon } from "./Icons";
import { Badge, Card } from "./ui";

/**
 * Offline ("cracked") play: a name and nothing else. No Microsoft account is
 * involved; the launcher gives Minecraft that name and its offline UUID, so
 * singleplayer and offline-mode servers work as usual.
 */
export function OfflineAccount() {
  const playAs = usePlayAs();
  const [draft, setDraft] = useState(playAs.name);
  // Keep the field in step when the name is changed somewhere else (the Play page).
  useEffect(() => setDraft(playAs.name), [playAs.name]);

  const problem = usernameError(draft);
  const shownProblem = draft.length > 0 ? problem : null;
  const active = playAs.mode === "offline" && playAs.name.trim().length > 0;

  return (
    <Card
      title="Offline / cracked account"
      icon={<UserIcon />}
      description="No sign-in needed. Singleplayer and offline-mode servers only."
      action={active ? <Badge tone="good">In use</Badge> : undefined}
      className="offline-card"
    >
      <form
        className="offline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (problem) return;
          playAs.useOffline(draft.trim());
        }}
      >
        <label htmlFor="offline-username">Cracked username</label>
        <input
          id="offline-username"
          type="text"
          value={draft}
          maxLength={16}
          autoComplete="off"
          spellCheck={false}
          placeholder="Steve"
          aria-invalid={shownProblem ? true : undefined}
          aria-describedby="offline-help"
          onChange={(event) => setDraft(event.target.value)}
        />
        <p id="offline-help" className={shownProblem ? "error-text" : "muted small"}>
          {shownProblem ?? "3–16 letters, numbers or underscores. The game starts as this player without checking an account."}
        </p>
        <Button type="submit" variant={active ? "secondary" : "primary"} disabled={Boolean(problem)}>
          Use this name
        </Button>
      </form>
      {active && (
        <p className="offline-note">
          Maple will start Minecraft as <strong>{playAs.name.trim()}</strong> until you sign in with Microsoft.
        </p>
      )}
    </Card>
  );
}
