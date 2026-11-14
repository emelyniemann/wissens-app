import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { nodeUrl } from '../components/Tree';
import { MARK_KINDS, markUrl, PageList, PagePicker, StatusBadge, type MarkKind } from '../components/ui';
import { base, db, now } from '../db';
import { useIdeas, useMeta, useNodes, usePages, useSearchIndex } from '../hooks';
import { downloadBackup, importData, type ImportResult } from '../importExport';
import { createPage, restorePage } from '../pages';
import { snippet } from '../search';
import { childrenOf } from '../tree';
import type { Page, TreeNode } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';

/* ================= Startseite ================= */
export function HomeScreen() {
  const pages = usePages();
  const ideas = useIdeas();
  const nodes = useNodes();
  const lastBackup = useMeta<number>('lastBackup');
  const recent = [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const drafts = pages.filter((p) => p.status === 'draft').length;
  const openIdeas = ideas.filter((i) => !i.done).length;
  const navigate = useNavigate();
  return (
    <div className="screen">
      <h1>Willkommen</h1>
      <p className="lead">Deine Wissensdatenbank – mit dem Training im Zentrum.</p>
      <div className="stats">
        <Link to="/inhalt" className="stat">
          <b>{pages.length}</b> Seiten
        </Link>
        <Link to="/entwuerfe" className="stat">
          <b>{drafts}</b> Entwürfe
        </Link>
        <Link to="/notizen" className="stat">
          <b>{openIdeas}</b> offene Ideen
        </Link>
        <Link to="/markierungen" className="stat">
          Markierungen
        </Link>
      </div>
      <div className="tiles">
        {childrenOf(nodes, null).map((n) => (
          <Link key={n.id} to={nodeUrl(n)} className="tile tile-root">
            {n.title}
          </Link>
        ))}
      </div>
      <div className="section-head">
        <h3>Zuletzt bearbeitet</h3>
        <button
          className="btn btn-small btn-primary"
          onClick={async () => {
            const id = await createPage();
            navigate(`/seite/${id}?neu=1`);
          }}
        >
          + Neue Seite
        </button>
      </div>
      <ul className="page-list">
        {recent.map((p) => (
          <li key={p.id}>
            <Link to={`/seite/${p.id}`} className="page-card">
              <div className="page-card-top">
                <strong>{p.title}</strong>
                <StatusBadge status={p.status} />
              </div>
              <small className="muted">{new Date(p.updatedAt).toLocaleString('de-DE')}</small>
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Alle Daten liegen nur auf diesem Gerät. Letzte Sicherung: {lastBackup ? new Date(lastBackup).toLocaleDateString('de-DE') : 'noch nie'} –{' '}
        <Link to="/daten">jetzt sichern</Link>.
      </p>
    </div>
  );
}

/* ================= Entwürfe ================= */
export function DraftsScreen() {
  const pages = usePages();
  return (
    <div className="screen">
      <h1>Entwürfe</h1>
      <p className="muted">Alle Seiten mit Prüfstatus „Entwurf (KI)“ – noch zu prüfen.</p>
      <PageList pages={pages.filter((p) => p.status === 'draft')} empty="Keine Entwürfe – alles geprüft." />
    </div>
  );
}

/* ================= Markierungen ================= */
export function MarkScreen() {
  const { kind = 'tag', value = '' } = useParams();
  const pages = usePages();
  const k = (kind in MARK_KINDS ? kind : 'tag') as MarkKind;
  const v = decodeURIComponent(value);
  const field = MARK_KINDS[k].field;
  const list = pages.filter((p) => p[field].some((x) => x.toLocaleLowerCase('de') === v.toLocaleLowerCase('de')));
  return (
    <div className="screen">
      <div className="crumbs">
        <Link to="/markierungen">Markierungen</Link> › {MARK_KINDS[k].label}
      </div>
      <h1>{v}</h1>
      <p className="muted">Alle Seiten mit der Markierung „{v}“ – automatisch zusammengestellt.</p>
      <PageList pages={list} />
    </div>
  );
}

export function MarksOverview() {
  const pages = usePages();
  const groups = useMemo(() => {
    const out: Record<MarkKind, Map<string, number>> = { sport: new Map(), region: new Map(), tag: new Map() };
    for (const p of pages)
      (Object.keys(MARK_KINDS) as MarkKind[]).forEach((k) => p[MARK_KINDS[k].field].forEach((v) => out[k].set(v, (out[k].get(v) ?? 0) + 1)));
    return out;
  }, [pages]);
  return (
    <div className="screen">
      <h1>Markierungen</h1>
      {(Object.keys(MARK_KINDS) as MarkKind[]).map((k) => (
        <section key={k}>
          <h3>{k === 'sport' ? 'Sportarten' : k === 'region' ? 'Körperregionen' : 'Tags'}</h3>
          <div className="mark-chips">
            {[...groups[k].entries()]
              .sort((a, b) => a[0].localeCompare(b[0], 'de'))
              .map(([v, c]) => (
                <Link key={v} to={markUrl(k, v)} className={'chip chip-' + k}>
                  {v} <small>{c}</small>
                </Link>
              ))}
            {!groups[k].size && <span className="muted">– noch keine –</span>}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ================= Suche ================= */
export function SearchScreen() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const index = useSearchIndex();
  const pages = usePages();
  const nodes = useNodes();
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const results = useMemo(() => (q.trim() ? index.search(q).slice(0, 60) : []), [index, q]);
  return (
    <div className="screen">
      <h1>Suche</h1>
      <input autoFocus className="input search-big" type="search" placeholder="Suchbegriff …" value={q} onChange={(e) => setParams({ q: e.target.value }, { replace: true })} />
      {q.trim() && <p className="muted small">{results.length} Treffer</p>}
      <ul className="page-list">
        {results.map((r) => {
          const [kind, id] = String(r.id).split(/:(.*)/s);
          if (kind === 'p') {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <li key={r.id}>
                <Link to={`/seite/${id}`} className="page-card">
                  <div className="page-card-top">
                    <strong>{p.title}</strong>
                    <StatusBadge status={p.status} />
                  </div>
                  <small className="muted">{snippet(r.body as string, q)}</small>
                </Link>
              </li>
            );
          }
          if (kind === 'n') {
            const n = nodes.find((x) => x.id === id);
            if (!n) return null;
            return (
              <li key={r.id}>
                <Link to={nodeUrl(n)} className="page-card">
                  <strong>📁 {n.title}</strong>
                  <small className="muted">Bereich</small>
                </Link>
              </li>
            );
          }
          return (
            <li key={r.id}>
              <Link to="/notizen" className="page-card">
                <strong>💡 {r.title as string}</strong>
                <small className="muted">Idee</small>
              </Link>
            </li>
          );
        })}
      </ul>
      {q.trim() && !results.length && <p className="muted">Nichts gefunden.</p>}
    </div>
  );
}

/* ================= Notizen / Ideenliste ================= */
export function IdeasScreen() {
  const ideas = useIdeas();
  const pages = usePages();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const open = ideas.filter((i) => !i.done).sort((a, b) => b.createdAt - a.createdAt);
  const done = ideas.filter((i) => i.done).sort((a, b) => b.updatedAt - a.updatedAt);

  const add = async () => {
    if (!text.trim()) return;
    await db.ideas.add({ ...base(), text: text.trim(), done: false, pageId: null });
    setText('');
    inputRef.current?.focus();
  };
  const upd = (id: string, patch: object) => db.ideas.update(id, { ...patch, updatedAt: now() });

  const row = (i: (typeof ideas)[number]) => {
    const linked = i.pageId ? byId.get(i.pageId) : undefined;
    return (
      <li key={i.id} className={'idea' + (i.done ? ' done' : '')}>
        <label className="check">
          <input type="checkbox" checked={i.done} onChange={(e) => upd(i.id, { done: e.target.checked })} aria-label="Abhaken" />
        </label>
        <div className="idea-body">
          <span className="idea-text">{i.text}</span>
          <div className="row wrap small">
            {linked ? (
              <>
                → <Link to={`/seite/${linked.id}`} className="int-link">{linked.title}</Link>
                <button className="link-btn" onClick={() => upd(i.id, { pageId: null })}>
                  Verknüpfung lösen
                </button>
              </>
            ) : (
              <>
                <button
                  className="link-btn"
                  onClick={async () => {
                    const pid = await createPage({ title: i.text.slice(0, 120) });
                    await upd(i.id, { pageId: pid });
                    navigate(`/seite/${pid}?neu=1`);
                  }}
                >
                  Seite daraus anlegen
                </button>
                <button className="link-btn" onClick={() => setLinkFor(i.id)}>
                  mit Seite verknüpfen
                </button>
              </>
            )}
            <button className="link-btn danger" onClick={() => upd(i.id, { deletedAt: now() })}>
              löschen
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="screen">
      <h1>Notizen & Ideen</h1>
      <form
        className="row idea-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input ref={inputRef} className="input" placeholder="Neue Idee oder neues Thema …" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary" type="submit">
          Erfassen
        </button>
      </form>
      <ul className="ideas">{open.map(row)}</ul>
      {!open.length && <p className="muted">Keine offenen Ideen.</p>}
      {done.length > 0 && (
        <button className="btn btn-small btn-ghost" onClick={() => setShowDone(!showDone)}>
          {showDone ? 'Erledigte ausblenden' : `Erledigte anzeigen (${done.length})`}
        </button>
      )}
      {showDone && <ul className="ideas">{done.map(row)}</ul>}
      {linkFor && <PagePicker title="Mit Seite verknüpfen" onPick={(p) => upd(linkFor, { pageId: p.id })} onClose={() => setLinkFor(null)} />}
    </div>
  );
}

/* ================= Inhaltsverzeichnis ================= */
export function TocScreen() {
  const nodes = useNodes();
  const pages = usePages();
  const byNode = useMemo(() => {
    const m = new Map<string, Page[]>();
    for (const p of pages) for (const id of p.nodeIds) m.set(id, [...(m.get(id) ?? []), p]);
    return m;
  }, [pages]);
  const orphans = pages.filter((p) => !p.nodeIds.some((id) => nodes.some((n) => n.id === id)));
  const render = (parent: string | null, depth: number) => (
    <ul className={depth === 0 ? 'toc' : ''}>
      {childrenOf(nodes, parent).map((n: TreeNode) => (
        <li key={n.id}>
          <Link to={nodeUrl(n)} className={depth === 0 ? 'toc-root' : 'toc-node'}>
            {n.title}
          </Link>
          {(byNode.get(n.id)?.length ?? 0) > 0 && (
            <ul className="toc-pages">
              {byNode
                .get(n.id)!
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title, 'de'))
                .map((p) => (
                  <li key={p.id}>
                    <Link to={`/seite/${p.id}`}>{p.title}</Link> {p.status === 'draft' && <span className="badge badge-draft tiny">Entwurf</span>}
                  </li>
                ))}
            </ul>
          )}
          {childrenOf(nodes, n.id).length > 0 && render(n.id, depth + 1)}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="screen">
      <h1>Inhaltsverzeichnis</h1>
      {render(null, 0)}
      {orphans.length > 0 && (
        <section>
          <h3>Ohne Zuordnung</h3>
          <PageList pages={orphans} />
        </section>
      )}
    </div>
  );
}

/* ================= Sicherung, Import, Papierkorb ================= */
export function DataScreen() {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const trash = useLiveQuery(async () => (await db.pages.toArray()).filter((p) => p.deletedAt !== null).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)), []) ?? [];

  const run = async (text: string) => {
    setError(null);
    setResult(null);
    try {
      setResult(await importData(JSON.parse(text)));
    } catch (e: any) {
      setError(e instanceof SyntaxError ? 'Die Datei/der Text ist kein gültiges JSON. Bitte prüfe, ob alles vollständig kopiert wurde.' : e.message);
    }
  };

  return (
    <div className="screen">
      <h1>Sicherung & Daten</h1>
      <section className="card">
        <h3>Sicherung herunterladen</h3>
        <p>Speichert alle Inhalte (Seiten, Bereiche, Ideen, Bilder) in einer Datei. Am besten regelmäßig machen und die Datei z. B. in deiner Cloud ablegen.</p>
        <button className="btn btn-primary" onClick={() => downloadBackup()}>
          ⬇ Sicherung herunterladen
        </button>
      </section>

      <section className="card">
        <h3>Datei einspielen</h3>
        <p>Für eine Sicherung oder für Seiten, die Claude im Chat für dich erstellt hat. Es wird nichts gelöscht: Neues kommt dazu, Vorhandenes wird nur durch neuere Stände ersetzt.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await run(await f.text());
            e.target.value = '';
          }}
        />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          📂 Datei auswählen …
        </button>
        <details className="paste">
          <summary>… oder Text aus dem Chat einfügen</summary>
          <textarea className="input mono" rows={8} placeholder='{"format": "wissens-app", "version": 1, "pages": [ … ]}' value={paste} onChange={(e) => setPaste(e.target.value)} />
          <button className="btn" disabled={!paste.trim()} onClick={() => run(paste)}>
            Einspielen
          </button>
        </details>
        {error && <p className="error">⚠ {error}</p>}
        {result && (
          <div className="ok-box">
            ✓ Eingespielt: {result.pagesNew} neue Seite(n), {result.pagesUpdated} aktualisiert, {result.nodes} Bereich(e), {result.ideas} Idee(n), {result.images} Bild(er).
            {result.warnings.length > 0 && (
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Papierkorb</h3>
        <p className="muted small">Gelöschte Seiten bleiben hier und können jederzeit zurückgeholt werden.</p>
        {!trash.length && <p className="muted">Leer.</p>}
        <ul className="trash">
          {trash.map((p) => (
            <li key={p.id}>
              <span>
                {p.title} <small className="muted">gelöscht am {new Date(p.deletedAt!).toLocaleDateString('de-DE')}</small>
              </span>
              <span className="row">
                <button className="btn btn-small" onClick={() => restorePage(p.id)}>
                  Wiederherstellen
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="screen">
      <p>Diese Ansicht gibt es nicht.</p>
      <Link to="/">Zur Startseite</Link>
    </div>
  );
}
