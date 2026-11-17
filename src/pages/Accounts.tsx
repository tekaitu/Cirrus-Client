import type { PageId } from "../components/Navigation";
import { AccountPanel } from "../components/AccountPanel";
import { PlayArrowIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { SkinHead } from "../components/SkinHead";
import { Card } from "../components/ui";
import type { Account } from "../hooks/useAuth";
import type { AppData } from "../hooks/useAppData";

/**
 * Name, skin and identity of one signed-in Minecraft account. The UUID is
 * internal account data and is deliberately not shown anywhere in the UI.
 */
function ProfileCard({
  player,
  onNavigate,
}: {
  player: { name: string; id: string };
  onNavigate: (page: PageId) => void;
}) {
  return (
    <Card title="Minecraft profile" icon={<UserIcon />} description="Your signed-in Minecraft account.">
      <div className="account-profile-card">
        <div className="account-profile-art" aria-hidden="true">
          <span className="account-profile-orbit account-profile-orbit-one" />
          <span className="account-profile-orbit account-profile-orbit-two" />
        </div>
        <div className="account-profile-content">
          <div className="account-profile-avatar">
            <SkinHead uuid={player.id} name={player.name} size={76} />
          </div>
          <div className="account-profile-identity">
            <span className="account-kicker">MINECRAFT: JAVA EDITION</span>
            <h2>{player.name}</h2>
            <span className="account-online-status">
              <span className="dot dot-live" aria-hidden="true" /> Connected and ready to play
            </span>
          </div>
        </div>
        <dl className="account-profile-details">
          <div>
            <dt>PLAYER NAME</dt>
            <dd>{player.name}</dd>
          </div>
          <div>
            <dt>ACCOUNT</dt>
            <dd>Microsoft</dd>
          </div>
        </dl>
        <div className="row account-profile-actions">
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("skins")}>
            Change skin
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Every account saved on this PC, with a way to switch or forget each one. */
function SavedAccounts({ account }: { account: Account }) {
  if (account.accounts.length === 0) return null;
  return (
    <Card title="Accounts on this PC" icon={<UserIcon />} description="Switch without signing in again.">
      <ul className="account-list">
        {account.accounts.map((entry) => {
          const active = entry.id === account.activeId;
          return (
            <li key={entry.id} className={active ? "on" : ""}>
              <SkinHead uuid={entry.id} name={entry.name} size={34} />
              <div className="account-list-text">
                <strong>{entry.name}</strong>
                <span className="muted small">{active ? "In use" : "Saved account"}</span>
              </div>
              {!active && (
                <button
                  type="button"
                  className="btn"
                  aria-label={`Switch to ${entry.name}`}
                  onClick={() => account.switchAccount(entry.id)}
                >
                  Use
                </button>
              )}
              <button
                type="button"
                className="btn btn-quiet"
                aria-label={`Remove ${entry.name}`}
                onClick={() => account.signOut(entry.id)}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
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
          <h1>Accounts</h1>
        </div>
        <div className={`account-connection-pill ${signedIn ? "is-connected" : "is-disconnected"}`}>
          <span className="account-connection-indicator" />
          {signedIn ? "Microsoft connected" : "No Microsoft account"}
        </div>
      </header>

      <div className="accounts-grid">
        <div className="accounts-main">
          {accountState.phase === "signedIn" && (
            <ProfileCard player={accountState.profile} onNavigate={onNavigate} />
          )}
          <SavedAccounts account={data.account} />
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
