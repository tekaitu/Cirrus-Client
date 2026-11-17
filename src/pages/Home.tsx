import { PlayPanel } from "../components/PlayPanel";
import { VersionCard } from "../components/VersionCard";
import { loaderLabel, loaderOf, useInstances } from "../hooks/useInstances";
import type { PageId } from "../components/Navigation";
import { GridIcon } from "../components/Icons";
import type { AppData } from "../hooks/useAppData";

/** The big title, the Play button and nothing else: what you are about to play and a way to start it. */
function Hero({ data, onNavigate, onOpenAccount }: { data: AppData; onNavigate: (page: PageId) => void; onOpenAccount: () => void }) {
  const { selection } = data;
  return (
    <section className="home-hero" aria-labelledby="hero-title">
      <h1 id="hero-title" className="home-title">
        {selection.version} {loaderLabel(selection.loader)}
      </h1>
      <p className="home-sub">{selection.profile ? selection.profile.name : "Minecraft Java Edition"}</p>
      <PlayPanel data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} variant="quick" />
    </section>
  );
}

/** Installed versions as cards along the bottom. Picking one makes it the version to play. */
function VersionRow({ data, onNavigate }: { data: AppData; onNavigate: (page: PageId) => void }) {
  const { selection } = data;
  const list = useInstances(data);
  const installed = list.state.status === "ready" ? list.state.data : [];
  const hasCurrent = installed.some((i) => i.minecraft === selection.version && loaderOf(i) === selection.loader);
  return (
    <section className="home-versions" aria-label="Your versions">
      <ul className="vrow">
        {installed.map((i) => {
          const l = loaderOf(i);
          return (
            <li key={`${i.minecraft}-${l}`}>
              <VersionCard
                version={i.minecraft}
                loader={loaderLabel(l)}
                selected={selection.version === i.minecraft && selection.loader === l}
                onSelect={() => {
                  selection.setVersion(i.minecraft);
                  selection.setLoader(l);
                }}
              />
            </li>
          );
        })}
        {!hasCurrent && (
          <li>
            <VersionCard
              version={selection.version}
              loader={loaderLabel(selection.loader)}
              line="Not installed yet"
              selected
              onSelect={() => undefined}
              selectLabel={`${selection.version} ${loaderLabel(selection.loader)} (selected, not installed)`}
            />
          </li>
        )}
        <li className="vrow-more">
          <button type="button" className="vc-more" aria-label="All versions" data-tip="All versions" onClick={() => onNavigate("versions")}>
            <GridIcon />
          </button>
        </li>
      </ul>
    </section>
  );
}

export function HomePage({
  data,
  onNavigate,
  onOpenAccount,
}: {
  data: AppData;
  onNavigate: (page: PageId) => void;
  onOpenAccount: () => void;
}) {
  return (
    <div className="home">
      <div className="home-screen">
        <Hero data={data} onNavigate={onNavigate} onOpenAccount={onOpenAccount} />
        <VersionRow data={data} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
