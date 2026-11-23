import { pageWindow } from "../core/mods";

/** The pages of results, like 1 2 3 … 40, with first/previous/next/last. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="pager-btn" aria-label="First page" disabled={page === 1} onClick={() => onPage(1)}>
        «
      </button>
      <button type="button" className="pager-btn" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {pageWindow(page, pages).map((n, i) =>
        n === null ? (
          <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`pager-btn ${n === page ? "pager-on" : ""}`}
            aria-label={`Page ${n}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" className="pager-btn" aria-label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)}>
        ›
      </button>
      <button type="button" className="pager-btn" aria-label="Last page" disabled={page === pages} onClick={() => onPage(pages)}>
        »
      </button>
    </nav>
  );
}
