import type { PageId } from "../components/Navigation";
import { AccountPanel } from "../components/AccountPanel";
import { useState } from "react";
import { KeyIcon, PlayArrowIcon, ShieldIcon, UserIcon } from "../components/Icons";
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
      description="Your active Minecraft identity on this device."
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
  const signedIn = data.account.state.phase === "signedIn";

  return (
    <div className="page accounts-page">
      <header className="page-head accounts-page-head">
        <div>
          <span className="account-kicker">CIRRUS IDENTITY</span>
          <h1>Accounts</h1>
          <p className="muted">
            Manage your Minecraft identity, Microsoft connection and offline profile.
          </p>
        </div>
        <div className={`account-connection-pill ${signedIn ? "is-connected" : "is-disconnected"}`}>
          <span className="account-connection-indicator" />
          {signedIn ? "Microsoft connected" : "No Microsoft account"}
        </div>
      </header>

      <section className="accounts-overview" aria-label="Account overview">
        <div className="accounts-overview-copy">
          <span className="account-kicker">YOUR PLAYER IDENTITY</span>
          <h2>{signedIn ? "You're ready for your next adventure." : "Your Minecraft journey starts here."}</h2>
          <p className="muted">
            {signedIn
              ? "Your Microsoft account is connected. Your profile and game access are managed securely by Cirrus."
              : "Connect a Microsoft account for online play, or use an offline player name for supported worlds and servers."}
          </p>
        </div>
        <div className="accounts-overview-mark" aria-hidden="true">
          <UserIcon />
        </div>
      </section>

      <div className="accounts-grid">
        <div className="accounts-main">
          {signedIn && <ProfileCard player={data.account.state.profile} onNavigate={onNavigate} />}
          <AccountPanel
            account={data.account}
            onNavigate={onNavigate}
            onSaveClientId={onSaveClientId}
          />
        </div>

        <aside className="accounts-side" aria-label="Account information">
          <Card title="Offline play" icon={<UserIcon />} description="Play without connecting an account.">
            <p className="muted small">
              Offline play starts Minecraft with a player name you choose. It works for singleplayer and
              for servers that run in offline mode. Servers that verify Microsoft accounts will refuse it.
            </p>
            <button type="button" className="btn" onClick={() => onNavigate("play")}>
              <PlayArrowIcon />
              Choose a player name
            </button>
          </Card>

          <Card title="Switching accounts" icon={<KeyIcon />} description="One Microsoft account at a time.">
            <p className="muted small">
              Cirrus Client keeps one signed-in Microsoft account. To use another account, sign out here
              and sign in again. Switching between Microsoft and offline play is done on the Play page.
            </p>
          </Card>

          <Card title="Your credentials" icon={<ShieldIcon />} description="Your sign-in stays protected.">
            <ul className="plain-list muted small">
              <li>Your password is entered on Microsoft's own sign-in page. Cirrus never sees it.</li>
              <li>Your sign-in token is stored in Windows Credential Manager, not in a regular file.</li>
              <li>Signing out removes the saved token from this PC.</li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
