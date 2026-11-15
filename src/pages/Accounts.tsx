import type { PageId } from "../components/Navigation";
import { AccountPanel } from "../components/AccountPanel";
import { useState } from "react";
import { KeyIcon, PlayArrowIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { SkinHead } from "../components/SkinHead";
import { Card } from "../components/ui";
import type { AppData } from "../hooks/useAppData";

function dashed(id: string): string {
  return /^[0-9a-f]{32}$/i.test(id) ? id.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") : id;
}

/** Name, id and skin of the signed-in Minecraft account. */
function ProfileCard({ player, onNavigate }: { player: { name: string; id: string }; onNavigate: (page: PageId) => void }) {
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
    <Card title="Minecraft profile" icon={<UserIcon />} description="The account Cirrus Client plays with.">
      <div className="profile-row">
        <SkinHead uuid={player.id} name={player.name} size={64} />
        <dl className="config-list">
          <div>
            <dt>Username</dt>
            <dd>
              <strong>{player.name}</strong>
            </dd>
          </div>
          <div>
            <dt>UUID</dt>
            <dd>
              <span className="path">{dashed(player.id)}</span>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="dot dot-live" aria-hidden="true" /> Signed in with Microsoft
            </dd>
          </div>
        </dl>
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Copied" : "Copy UUID"}
        </button>
        <button type="button" className="btn" onClick={() => onNavigate("skins")}>
          Change skin
        </button>
      </div>
    </Card>
  );
}

/** Microsoft sign-in, how offline play works, and where credentials are kept. Everything shown is real state. */
export function AccountsPage({
  data,
  onNavigate,
  onSaveClientId,
}: {
  data: AppData;
  onNavigate: (page: PageId, section?: string) => void;
  onSaveClientId: (id: string) => Promise<string | null>;
}) {
  return (
    <div className="page accounts-page">
      <header className="page-head">
        <h1>Accounts</h1>
        <p className="muted">Sign in to play online, or play offline with just a name.</p>
      </header>

      <div className="accounts-grid">
        <div className="accounts-main">
          {data.account.state.phase === "signedIn" && (
            <ProfileCard player={data.account.state.profile} onNavigate={onNavigate} />
          )}
          <AccountPanel account={data.account} onNavigate={onNavigate} onSaveClientId={onSaveClientId} />
        </div>
        <div className="accounts-side">
          <Card title="Offline play" icon={<UserIcon />} description="No account needed.">
            <p className="muted small">
              Offline play starts the game with a player name you choose. It works for singleplayer and for servers that
              run in offline mode. Servers that check Microsoft accounts will refuse it.
            </p>
            <button type="button" className="btn" onClick={() => onNavigate("play")}>
              <PlayArrowIcon />
              Choose a player name
            </button>
          </Card>
          <Card title="Switching accounts" icon={<KeyIcon />} description="One Microsoft account at a time.">
            <p className="muted small">
              Cirrus Client keeps one signed-in Microsoft account. To use a different one, sign out here and sign in again.
              Switching between Microsoft and offline play is done on the Play page.
            </p>
          </Card>
          <Card title="Your credentials" icon={<ShieldIcon />} description="How sign-in data is handled.">
            <ul className="plain-list muted small">
              <li>Your password is typed on Microsoft&apos;s own page. Cirrus never sees it.</li>
              <li>The sign-in token is kept in Windows Credential Manager, not in a file.</li>
              <li>Signing out removes the saved token from this PC.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
