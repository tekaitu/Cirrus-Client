import type { PageId } from "../components/Navigation";
import { AccountPanel } from "../components/AccountPanel";
import { useState } from "react";
import { PlayArrowIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { SkinHead } from "../components/SkinHead";
import { Card } from "../components/ui";
import type { AppData } from "../hooks/useAppData";

function dashed(id: string): string {
  return /^[0-9a-f]{32}$/i.test(id)
    ? id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5")
    : id;
}

/** Name, id and skin of the signed-in Minecraft account. */
function ProfileCard({
  player,
  onNavigate,
}: {
  player: { name: string; id: string };
  onNavigate: (page: PageId) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard
      ?.writeText(dashed(player.id))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => {});
  };

  return (
    <Card
      title="Minecraft profile"
      icon={<UserIcon />}
      description="Your Minecraft account."
    >
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
            <span className="account-kicker">MICROSOFT ACCOUNT</span>
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
            <dt>PLAYER UUID</dt>
            <dd className="path">{dashed(player.id)}</dd>
          </div>
        </dl>
        <div className="row account-profile-actions">
          <button type="button" className="btn" onClick={copy}>
            {copied ? "Copied" : "Copy UUID"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate("skins")}>
            Change skin
          </button>
        </div>
      </div>
    </Card>
  );
}

/** Microsoft sign-in, offline play guidance, and credential handling. */
export function AccountsPage({
  data,
  onNavigate,
  onSaveClientId,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
  onSaveClientId: (id: string) => Promise<string | null>;
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
          <AccountPanel
            account={data.account}
            onNavigate={onNavigate}
            onSaveClientId={onSaveClientId}
          />
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
              You sign in on Microsoft's own page; Cirrus never sees your password. The sign-in token is kept in
              Windows Credential Manager.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
