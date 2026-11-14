import { isMicrosoftLink, minutesLeft } from "../core/auth";
import type { Account } from "../hooks/useAuth";
import { CodeQr } from "./AccountPanel";

/**
 * Microsoft sign-in as a window in the middle of the screen:
 * "Microsoft sign-in" while the Microsoft window is open, "Sign in with a code" for the code flow.
 */
export function SignInDialog({ account }: { account: Account }) {
  const { state } = account;
  if (state.phase !== "starting" && state.phase !== "waiting") return null;

  return (
    <div className="modal-backdrop">
      <div className="modal signin-modal" role="dialog" aria-modal="true" aria-label="Microsoft sign-in">
        {state.phase === "starting" && (
          <div className="code-card" role="status" aria-live="polite">
            <h3 className="code-title">Microsoft sign-in</h3>
            <span className="signin-spinner" aria-hidden="true" />
            <p className="muted small account-name">
              {state.method === "window" ? "Finish signing in in the Microsoft window…" : "Contacting Microsoft…"}
            </p>
            <button type="button" className="btn btn-block" onClick={account.cancel}>
              Cancel
            </button>
          </div>
        )}

        {state.phase === "waiting" && (
          <div className="code-card" role="status" aria-live="polite">
            <h3 className="code-title">Sign in with a code</h3>
            <div className="code-row">
              <p className="device-code" aria-label={`Sign-in code ${state.code.userCode}`}>
                {state.code.userCode}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void Promise.resolve(navigator.clipboard?.writeText(state.code.userCode)).catch(() => {})}
              >
                Copy
              </button>
            </div>
            <p className="muted small">
              Open the Microsoft page on any device and enter the code above. It works for about{" "}
              {minutesLeft(state.code.expiresIn)} minutes. Cirrus Client never sees your password.
            </p>
            {isMicrosoftLink(state.code.verificationUri) && (
              <button type="button" className="btn btn-block" onClick={() => account.openLink(state.code.verificationUri)}>
                Open Microsoft page
              </button>
            )}
            {state.code.verificationUri.startsWith("https://www.microsoft.com/link") && (
              <CodeQr code={state.code.userCode} />
            )}
            {!isMicrosoftLink(state.code.verificationUri) && (
              <p className="error-text" role="alert">
                Microsoft returned an unexpected address, so no button is offered. Do not enter the code anywhere
                except a microsoft.com page.
              </p>
            )}
            <p className="muted small path">{state.code.verificationUri}</p>
            {account.linkError && (
              <p className="error-text" role="alert">
                {account.linkError}
              </p>
            )}
            <p className="code-wait">
              <span className="mini-spinner" aria-hidden="true" /> Waiting for confirmation
            </p>
            <button type="button" className="btn btn-block" onClick={account.cancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
