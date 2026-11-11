import { useState } from "react";
import { CLIENT_ID_PATTERN } from "../core/settings";
import { formatUuid, isMicrosoftLink, minutesLeft } from "../core/auth";
import type { Account } from "../hooks/useAuth";
import type { PageId } from "./Sidebar";
import { Banner, Card, Skeleton } from "./ui";

/**
 * Real Microsoft account state. Every state here comes from the backend; the
 * sign-in button only exists once an Azure app ID has been saved in Settings.
 */
const REDIRECT_URI = "https://login.microsoftonline.com/consumers/oauth2/nativeclient";

/** One-time owner setup: paste the Azure application ID and sign in straight away. */
function SignInSetup({ onSave }: { onSave: (id: string) => Promise<string | null> }) {
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save() {
    const value = id.trim();
    if (!CLIENT_ID_PATTERN.test(value)) {
      setError("This should look like 00000000-0000-0000-0000-000000000000 (the Application (client) ID from Azure).");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      setError(await onSave(value));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(REDIRECT_URI);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="setup">
      <details className="setup-guide">
        <summary>How to get the app ID (one time, free)</summary>
        <ol>
          <li>Open the Azure portal, then <strong>App registrations</strong> and <strong>New registration</strong>.</li>
          <li>Account type: <strong>Personal Microsoft accounts only</strong>.</li>
          <li>
            Redirect URI: type <strong>Public client/native</strong> and use{" "}
            <code className="path">{REDIRECT_URI}</code>{" "}
            <button type="button" className="link-button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </li>
          <li>
            Copy the <strong>Application (client) ID</strong> and paste it below. It is an ID, not a secret.
          </li>
          <li>
            Minecraft sign-in only works once Mojang approves that ID (request it at aka.ms/AppRegInfo). Until
            then Microsoft sign-in succeeds but Minecraft refuses it.
          </li>
        </ol>
      </details>
      <label className="setup-field" htmlFor="setup-client-id">
        Application (client) ID
      </label>
      <input
        id="setup-client-id"
        type="text"
        spellCheck={false}
        autoComplete="off"
        placeholder="00000000-0000-0000-0000-000000000000"
        value={id}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setId(e.target.value)}
      />
      {error && <p className="error-text" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary btn-block" disabled={saving} onClick={save}>
        Save and continue
      </button>
    </div>
  );
}

export function AccountPanel({
  account,
  onNavigate,
  onSaveClientId,
}: {
  account: Account;
  onNavigate: (page: PageId) => void;
  onSaveClientId?: (id: string) => Promise<string | null>;
}) {
  const { state } = account;

  return (
    <Card title="Account" className="account-card">
      {state.phase === "checking" && <Skeleton label="Checking account" lines={2} />}

      {state.phase === "notConfigured" && (
        <>
          <div className="account-row">
            <span className="avatar" aria-hidden="true">?</span>
            <div>
              <p className="account-name">Not signed in</p>
              <p className="muted small">
                Sign-in is not set up in this build yet: it needs an app ID registered with Microsoft and approved
                by Mojang. Players never type one; the owner adds it once.
              </p>
            </div>
          </div>
          {onSaveClientId && <SignInSetup onSave={onSaveClientId} />}
          <button type="button" className="btn btn-block" onClick={() => onNavigate("settings")}>
            Set up sign-in (owner)
          </button>
        </>
      )}

      {state.phase === "signedOut" && (
        <>
          <div className="account-row">
            <span className="avatar" aria-hidden="true">?</span>
            <div>
              <p className="account-name">Not signed in</p>
              <p className="muted small">Sign in with your Microsoft account that owns Minecraft: Java Edition.</p>
            </div>
          </div>
          {state.message && <p className="error-text" role="alert">{state.message}</p>}
          <button type="button" className="btn btn-primary btn-block" onClick={() => account.signIn("window")}>
            Sign in with Microsoft
          </button>
          <button type="button" className="link-button" onClick={() => account.signIn("code")}>
            Use a code instead
          </button>
          <p className="muted small">
            Opens Microsoft&apos;s own sign-in page. Unlimited only asks to sign in to Minecraft and never sees
            your password.
          </p>
        </>
      )}

      {state.phase === "starting" && (
        <div role="status" aria-live="polite">
          <p className="account-name">
            {state.method === "window" ? "Finish signing in in the Microsoft window…" : "Contacting Microsoft…"}
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={account.cancel}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.phase === "waiting" && (
        <div role="status" aria-live="polite">
          <p className="muted small">On the Microsoft page, enter this code:</p>
          <p className="device-code" aria-label={`Sign-in code ${state.code.userCode}`}>
            {state.code.userCode}
          </p>
          <p className="muted small">
            Waiting for you to finish in your browser. The code works for about{" "}
            {minutesLeft(state.code.expiresIn)} minutes. Unlimited never sees your password.
          </p>
          <div className="row">
            {isMicrosoftLink(state.code.verificationUri) && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => account.openLink(state.code.verificationUri)}
              >
                Open Microsoft page
              </button>
            )}
            <button type="button" className="btn" onClick={account.cancel}>
              Cancel
            </button>
          </div>
          {!isMicrosoftLink(state.code.verificationUri) && (
            <p className="error-text" role="alert">
              Microsoft returned an unexpected address, so no button is offered. Do not enter the code
              anywhere except a microsoft.com page.
            </p>
          )}
          <p className="muted small path">{state.code.verificationUri}</p>
          {account.linkError && <p className="error-text" role="alert">{account.linkError}</p>}
        </div>
      )}

      {state.phase === "signedIn" && (
        <>
          <div className="account-row">
            <span className="avatar avatar-ok" aria-hidden="true">
              {state.profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="account-name">{state.profile.name}</p>
              <p className="muted small path">{formatUuid(state.profile.id)}</p>
            </div>
          </div>
          {state.note && <p className="muted small">{state.note}</p>}
          <button type="button" className="btn btn-block" onClick={account.signOut}>
            Sign out
          </button>
        </>
      )}

      {state.phase === "error" && (
        <Banner
          tone="bad"
          title="Sign-in problem"
          actions={
            <button type="button" className="btn" onClick={() => account.signIn("window")}>
              Try again
            </button>
          }
        >
          {state.message}
        </Banner>
      )}
    </Card>
  );
}
