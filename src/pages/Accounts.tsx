import type { PageId } from "../components/Navigation";
import { AccountPanel } from "../components/AccountPanel";
import { CharacterPreview } from "../components/CharacterPreview";
import { PlayArrowIcon, PlusIcon, ShieldIcon, UserIcon, WarningIcon } from "../components/Icons";
import { Button } from "../components/Button";
import { SkinHead } from "../components/SkinHead";
import { Badge, Card } from "../components/ui";
import type { AppData } from "../hooks/useAppData";
import { useState } from "react";
import { formatUuid } from "../core/auth";
import { usePlayerAppearance } from "../hooks/useAppearance";

/**
 * Name, character and identity of one signed-in Minecraft account. The UUID is
 * shown because it is the account's public Minecraft identity, not a secret;
 * the sign-in token never reaches the interface.
 */
function ProfileCard({
  player,
  onNavigate,
}: {
  player: { name: string; id: string; ownsMinecraft?: boolean };
  onNavigate: (page: PageId) => void;
}) {
  const appearance = usePlayerAppearance(player.id);
  const character = appearance.appearance;
  return (
    <Card
      title="Minecraft profile"
      icon={<UserIcon />}
      description="The account Cirrus will start Minecraft with."
      action={<Badge tone="good">Active account</Badge>}
    >
      <div className="account-profile-card">
        <div className="account-profile-figure">
          <CharacterPreview player={player} scale={7} />
        </div>
        <div className="account-profile-content">
          <span className="account-kicker">MINECRAFT: JAVA EDITION</span>
          <h2>{player.name}</h2>
          <span className="account-online-status">
            <span className="dot dot-live" aria-hidden="true" /> Microsoft account connected
          </span>
          <dl className="account-details">
            <div>
              <dt>Player name</dt>
              <dd>{player.name}</dd>
            </div>
            <div>
              <dt>Minecraft UUID</dt>
              <dd className="account-uuid">{formatUuid(player.id)}</dd>
            </div>
            <div>
              <dt>Ownership</dt>
              <dd>
                {player.ownsMinecraft
                  ? "Minecraft: Java Edition owned"
                  : "Ownership not reported by this build"}
              </dd>
            </div>
            <div>
              <dt>Skin model</dt>
              <dd>{character ? (character.model === "slim" ? "Slim" : "Classic") : appearance.loading ? "Loading…" : "Not loaded"}</dd>
            </div>
            <div>
              <dt>Cape</dt>
              <dd>{character?.cape ? "Equipped on your account" : "None equipped"}</dd>
            </div>
            <div>
              <dt>Skin</dt>
              <dd>{character ? "Loaded from your account" : "Unavailable"}</dd>
            </div>
          </dl>
          <div className="row account-profile-actions">
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate("skins")}
              icon={<UserIcon />}
            >
              Change skin
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Every account saved on this PC, with a way to switch or forget each one. */
function SavedAccounts({ data }: { data: AppData }) {
  const account = data.account;
  const [confirm, setConfirm] = useState<string | null>(null);
  if (account.accounts.length === 0) return null;
  return (
    <Card
      title="Accounts on this PC"
      icon={<UserIcon />}
      description="Switch without signing in again."
      action={
        <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={() => account.signIn()}>
          Add account
        </Button>
      }
    >
      <ul className="account-list">
        {account.accounts.map((entry) => {
          const active = entry.id === account.activeId;
          const asking = confirm === entry.id;
          return (
            <li key={entry.id} className={active ? "on" : ""}>
              <SkinHead uuid={entry.id} name={entry.name} size={38} />
              <div className="account-list-text">
                <strong>{entry.name}</strong>
                <span className="muted small">{active ? "Active account" : "Saved account"}</span>
              </div>
              {active ? (
                <Badge tone="good">In use</Badge>
              ) : (
                <button
                  type="button"
                  className="btn btn-small"
                  aria-label={`Switch to ${entry.name}`}
                  onClick={() => account.switchAccount(entry.id)}
                >
                  Use
                </button>
              )}
              {asking ? (
                <span className="account-confirm" role="group" aria-label={`Remove ${entry.name}?`}>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    aria-label={`Confirm removing ${entry.name}`}
                    onClick={() => {
                      setConfirm(null);
                      account.signOut(entry.id);
                    }}
                  >
                    Remove
                  </button>
                  <button type="button" className="btn btn-quiet btn-small" onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-quiet btn-small"
                  aria-label={`Remove ${entry.name}`}
                  onClick={() => setConfirm(entry.id)}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Removing an account only forgets its sign-in on this PC. Your Minecraft account and worlds are untouched.
      </p>
    </Card>
  );
}

/** Microsoft sign-in, saved accounts, offline play guidance and credential handling. */
export function AccountsPage({
  data,
  onNavigate,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
}) {
  // Keep a stable reference so TypeScript can narrow the discriminated union.
  const accountState = data.account.state;
  const signedIn = accountState.phase === "signedIn";

  return (
    <div className="page accounts-page">
      <header className="page-head accounts-page-head">
        <div>
          <p className="eyebrow">Identity</p>
          <h1>Accounts</h1>
          <p>Your Microsoft account is what Minecraft uses for skins, capes and online servers.</p>
        </div>
        <div className="page-actions">
          <div className={`account-connection-pill ${signedIn ? "is-connected" : "is-disconnected"}`}>
            <span className="account-connection-indicator" />
            {signedIn ? "Microsoft connected" : "No Microsoft account"}
          </div>
          {!signedIn && (
            <Button variant="primary" size="md" onClick={() => data.account.signIn()} icon={<PlusIcon />}>
              Add account
            </Button>
          )}
        </div>
      </header>

      <div className="accounts-grid">
        <div className="accounts-main">
          {accountState.phase === "signedIn" && (
            <ProfileCard player={accountState.profile} onNavigate={onNavigate} />
          )}
          {accountState.phase === "error" && (
            <div className="banner banner-bad" role="alert">
              <WarningIcon />
              <div>
                <strong>Sign-in problem</strong>
                <p>{accountState.message}</p>
              </div>
            </div>
          )}
          <SavedAccounts data={data} />
          <AccountPanel account={data.account} />
        </div>

        <aside className="accounts-side" aria-label="Account information">
          <Card title="Offline play" icon={<UserIcon />}>
            <p className="muted small">Play singleplayer or offline-mode servers with any name, no account needed.</p>
            <button type="button" className="btn" onClick={() => onNavigate("versions")}>
              <PlayArrowIcon />
              Choose a player name
            </button>
          </Card>

          <Card title="Your sign-in is protected" icon={<ShieldIcon />}>
            <p className="muted small">
              You sign in on Microsoft's own page; Cirrus never sees your password. Each account's sign-in token is
              kept in Windows Credential Manager, never in a settings file.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
