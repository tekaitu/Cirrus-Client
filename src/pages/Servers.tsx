import { ServerIcon } from "../components/Icons";

/** Partner servers. Nothing is listed until there is a real partner, and nothing here is made up. */
export function ServersPage() {
  return (
    <div className="page servers-page">
      <header className="page-head">
        <p className="eyebrow">Community</p>
        <h1>Servers</h1>
        <p>Servers Maple Client works with will be listed here.</p>
      </header>
      <section className="servers-empty" aria-label="Partner servers">
        <span className="servers-empty-icon" aria-hidden="true">
          <ServerIcon />
        </span>
        <h2>No partner servers yet</h2>
        <p>When a server joins Maple as a partner, you will be able to see it and join it from this page.</p>
      </section>
    </div>
  );
}
