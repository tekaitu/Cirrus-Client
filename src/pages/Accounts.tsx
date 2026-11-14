import type { PageId } from "../components/Sidebar";
import { AccountPanel } from "../components/AccountPanel";
import { KeyIcon, PlayArrowIcon, ShieldIcon, UserIcon } from "../components/Icons";
import { Card } from "../components/ui";
import type { AppData } from "../hooks/useAppData";

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
