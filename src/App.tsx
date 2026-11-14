import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Tree } from './components/Tree';
import { DraftFilterContext, PromptModal } from './components/ui';
import { base, db } from './db';
import { useStoredState } from './hooks';
import { NodeScreen } from './screens/NodeScreen';
import { PageScreen } from './screens/PageScreen';
import { DataScreen, DraftsScreen, HomeScreen, IdeasScreen, MarkScreen, MarksOverview, NotFound, SearchScreen, TocScreen } from './screens/Screens';

export default function App() {
  const [onlyDrafts, setOnlyDrafts] = useStoredState('only-drafts', false);
  const [drawer, setDrawer] = useState(false);
  const [quickIdea, setQuickIdea] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <DraftFilterContext.Provider value={{ onlyDrafts, setOnlyDrafts }}>
      <div className={'app' + (drawer ? ' drawer-open' : '')}>
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setDrawer(!drawer)} aria-label="Menü">
            ☰
          </button>
          <Link to="/" className="brand">
            Wissen
          </Link>
          <input
            className="input top-search"
            type="search"
            placeholder="Suchen …"
            aria-label="Suchen"
            value={location.pathname === '/suche' ? new URLSearchParams(location.search).get('q') ?? '' : ''}
            onChange={(e) => navigate(`/suche?q=${encodeURIComponent(e.target.value)}`, { replace: location.pathname === '/suche' })}
            onFocus={() => location.pathname !== '/suche' && navigate('/suche')}
          />
          <button className="btn btn-accent idea-btn" onClick={() => setQuickIdea(true)} title="Idee schnell erfassen">
            💡<span className="hide-sm"> Idee</span>
          </button>
        </header>

        <aside className="sidebar">
          <div className="side-links">
            <NavLink to="/" end>
              Start
            </NavLink>
            <NavLink to="/inhalt">Inhaltsverzeichnis</NavLink>
            <NavLink to="/markierungen">Markierungen</NavLink>
            <NavLink to="/entwuerfe">Entwürfe</NavLink>
          </div>
          <label className="check draft-filter">
            <input type="checkbox" checked={onlyDrafts} onChange={(e) => setOnlyDrafts(e.target.checked)} /> nur Entwürfe anzeigen
          </label>
          <Tree onNavigate={() => setDrawer(false)} />
          <div className="side-links side-bottom">
            <NavLink to="/daten">Sicherung & Daten</NavLink>
          </div>
        </aside>
        <div className="scrim" onClick={() => setDrawer(false)} />

        <main className="main">
          {onlyDrafts && (
            <div className="filter-banner">
              Filter aktiv: nur Entwürfe.{' '}
              <button className="link-btn" onClick={() => setOnlyDrafts(false)}>
                Aus
              </button>
            </div>
          )}
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/bereich/:id" element={<NodeScreen />} />
            <Route path="/seite/:id" element={<PageScreen />} />
            <Route path="/markierung/:kind/:value" element={<MarkScreen />} />
            <Route path="/markierungen" element={<MarksOverview />} />
            <Route path="/suche" element={<SearchScreen />} />
            <Route path="/notizen" element={<IdeasScreen />} />
            <Route path="/inhalt" element={<TocScreen />} />
            <Route path="/entwuerfe" element={<DraftsScreen />} />
            <Route path="/daten" element={<DataScreen />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {quickIdea && (
          <PromptModal
            title="Idee erfassen"
            label="Was möchtest du festhalten?"
            okLabel="Speichern"
            onOk={async (t) => {
              await db.ideas.add({ ...base(), text: t, done: false, pageId: null });
              setToast('Idee gespeichert');
            }}
            onClose={() => setQuickIdea(false)}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </DraftFilterContext.Provider>
  );
}
