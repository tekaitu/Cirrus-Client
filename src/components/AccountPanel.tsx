import { formatUuid, isMicrosoftLink, minutesLeft } from "../core/auth";
import type { Account } from "../hooks/useAuth";
import type { PageId } from "./Sidebar";
import { Banner, Card, Skeleton } from "./ui";

/**
 * Real Microsoft account state. Every state here comes from the backend; the
 * sign-in button only exists once an Azure app ID has been saved in Settings.
 */
export function AccountPanel({ account, onNavigate }: { account: Account; onNavigate: (page: PageId) => void }) {
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
                Microsoft sign-in needs an Azure app ID that you register yourself. Add it in Settings to turn
                sign-in on.
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-block" onClick={() => onNavigate("settings")}>
            Set up sign-in
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
          <button type="button" className="btn btn-primary btn-block" onClick={account.signIn}>
            Sign in with Microsoft
          </button>
        </>
      )}

      {state.phase === "starting" && (
        <div role="status" aria-live="polite">
          <p className="account-name">Contacting Microsoft…</p>
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
            {minutesLeft(state.code.expiresIn)} minutes. Limited FPS never sees your password.
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
            <button type="button" className="btn" onClick={account.signIn}>
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
