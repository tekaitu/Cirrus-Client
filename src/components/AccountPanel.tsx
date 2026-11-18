import { BrandIcon } from "./BrandIcon";
import { Button } from "./Button";
import { useEffect, useState } from "react";
import type { Account } from "../hooks/useAuth";
import { SkinHead } from "./SkinHead";
import { formatUuid } from "../core/auth";
import { usePlayerAppearance } from "../hooks/useAppearance";
import { RefreshArrowIcon } from "./Icons";
import { Banner, Card, Skeleton } from "./ui";

/**
 * The account card used by the account menu (and the Accounts page). Every
 * state comes from the backend; the profile is the Minecraft player name and
 * their skin, never the UUID. Sign-in configuration is not exposed here at all.
 */

/** QR code of the Microsoft link with the code already filled in. Quietly shows nothing if it cannot be drawn. */
export function CodeQr({ code }: { code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void import("qrcode")
      .then((m) => (m.default ?? m).toDataURL(`https://www.microsoft.com/link?otc=${encodeURIComponent(code)}`, { margin: 1, width: 132 }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [code]);
  if (!src) return null;
  return (
    <div className="code-qr">
      <img src={src} width={76} height={76} alt="QR code that opens the Microsoft page with your code filled in" />
      <div>
        <strong>Scan the code</strong>
        <small>Opens the page with the code already filled in.</small>
      </div>
    </div>
  );
}

export function AccountPanel({
  account,
  onManage,
}: {
  account: Account;
  /** Shown as a "Manage accounts" button (the pop-up in the top bar); the Accounts page itself leaves it out. */
  onManage?: () => void;
}) {
  const { state } = account;
  const profile = state.phase === "signedIn" ? state.profile : null;
  const appearance = usePlayerAppearance(profile?.id ?? null);

  return (
    <Card title="Account" className="account-card">
      {state.phase === "checking" && <Skeleton label="Checking account" lines={2} />}

      {state.phase === "notConfigured" && (
        <>
          <div className="account-hero">
            <div className="account-hero-brand">
              <BrandIcon name="minecraft" size={24} />
            </div>
            <p className="muted small">Sign-in is not available in this build.</p>
          </div>
        </>
      )}

      {state.phase === "signedOut" && (
        <>
          <div className="account-hero">
            <div className="account-hero-brand">
              <BrandIcon name="minecraft" size={26} />
            </div>
            <p className="account-name">Not signed in</p>
            <p className="muted small">Use the Microsoft account that owns Minecraft: Java Edition.</p>
          </div>
          {state.message && (
            <p className="error-text" role="alert">
              {state.message}
            </p>
          )}
          <button
            type="button"
            className="btn btn-signin btn-block"
            aria-label="Sign in with Microsoft"
            onClick={() => account.signIn()}
          >
            <span className="signin-icons" aria-hidden="true">
              <BrandIcon name="microsoft" size={22} />
            </span>
            <span className="signin-text">
              <strong>Sign in with Microsoft</strong>
              <small>Minecraft: Java Edition</small>
            </span>
          </button>
          <button type="button" className="btn btn-quiet btn-block" onClick={() => account.signIn("code")}>
            Sign in with a code instead
          </button>
        </>
      )}

      {/* "starting" and "waiting" are shown by SignInDialog, a window in the middle of the screen */}

      {state.phase === "signedIn" && (
        <>
          <div className="account-row">
            <SkinHead uuid={state.profile.id} name={state.profile.name} size={44} />
            <div className="account-identity">
              <p className="account-name">{state.profile.name}</p>
              <span className="account-status-line">
                <span className="dot dot-live" aria-hidden="true" />
                Microsoft connected
              </span>
            </div>
          </div>
          <dl className="account-details">
            <div>
              <dt>Player name</dt>
              <dd>{state.profile.name}</dd>
            </div>
            <div>
              <dt>Ownership</dt>
              <dd>
                {state.profile.ownsMinecraft
                  ? "Minecraft: Java Edition owned"
                  : "Ownership not reported by this build"}
              </dd>
            </div>
            <div>
              <dt>Skin model</dt>
              <dd>{appearance.appearance ? (appearance.appearance.model === "slim" ? "Slim" : "Classic") : "Not loaded"}</dd>
            </div>
            <div>
              <dt>Cape</dt>
              <dd>{appearance.appearance?.cape ? "Equipped on your account" : "None equipped"}</dd>
            </div>
            <div>
              <dt>Minecraft UUID</dt>
              <dd className="account-uuid">{formatUuid(state.profile.id)}</dd>
            </div>
          </dl>
          {account.accounts.length > 1 && (
            <p className="muted small">{account.accounts.length} accounts signed in on this PC</p>
          )}
          {state.note && <p className="muted small">{state.note}</p>}
          <div className="row">
            <Button size="sm" icon={<RefreshArrowIcon />} loading={appearance.loading} onClick={appearance.reload}>
              Refresh profile
            </Button>
            <Button size="sm" onClick={() => account.signIn()}>
              Add another account
            </Button>
            <Button size="sm" variant="ghost" onClick={() => account.signOut()}>
              Sign out
            </Button>
          </div>
        </>
      )}

      {state.phase === "error" && (
        <Banner
          tone="bad"
          title="Sign-in problem"
          actions={
            <button type="button" className="btn" onClick={() => account.signIn()}>
              Try again
            </button>
          }
        >
          {state.message}
        </Banner>
      )}
      {onManage && state.phase !== "checking" && (
        <button type="button" className="btn btn-quiet btn-block" onClick={onManage}>
          Manage accounts
        </button>
      )}
    </Card>
  );
}
