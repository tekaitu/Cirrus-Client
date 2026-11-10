import { useState } from "react";
import { LICENSE_SECTIONS, LICENSE_TITLE } from "../content/license";

/**
 * The license. In "gate" mode it must be accepted before the launcher is used;
 * in "view" mode it can simply be read and closed.
 */
export function LicenseDialog({
  mode,
  onAccept,
  onDecline,
  onClose,
}: {
  mode: "gate" | "view";
  onAccept?: () => void;
  onDecline?: () => void;
  onClose?: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="license-title">
        <h2 id="license-title" className="modal-title">
          {LICENSE_TITLE}
        </h2>
        <div className="license-text" tabIndex={0} aria-label="License text">
          {LICENSE_SECTIONS.map((s, i) => (
            <section key={s.title}>
              <h3>
                {i + 1}. {s.title}
              </h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
        {mode === "gate" ? (
          <>
            <label className="check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have read the license, and I own Minecraft: Java Edition.</span>
            </label>
            <div className="row">
              <button type="button" className="btn btn-primary btn-pill btn-glow" disabled={!agreed} onClick={onAccept}>
                Accept and continue
              </button>
              <button type="button" className="btn btn-pill btn-quiet" onClick={onDecline}>
                Decline and quit
              </button>
            </div>
          </>
        ) : (
          <div className="row">
            <button type="button" className="btn btn-pill" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
