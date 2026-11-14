import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { nodeUrl } from '../components/Tree';
import { markUrl, PageList, PromptModal, StatusBadge, useDraftFilter } from '../components/ui';
import { useNodes, usePages, useSearchIndex, useStoredState } from '../hooks';
import {
  applyFilter,
  availableMarks,
  directAreaLabel,
  filterActive,
  isMarkSelected,
  normalizeFilter,
  sortPages,
  toggleMark,
  type MarkKind,
  type NodeFilter,
  type SortKey,
} from '../nodeFilter';
import { createPage } from '../pages';
import { childrenOf, createNode, descendantIds, pathOf } from '../tree';
import type { Page } from '../types';

export function NodeScreen() {
  const { id = '' } = useParams();
  // "key" sorgt dafür, dass beim Wechsel des Bereichs dessen eigene Filter geladen werden.
  return <NodeScreenInner key={id} id={id} />;
}

function readOldWithSub(): boolean {
  try {
    const raw = localStorage.getItem('node-with-sub');
    return raw === null ? true : JSON.parse(raw) !== false;
  } catch {
    return true;
  }
}

function NodeScreenInner({ id }: { id: string }) {
  const nodes = useNodes();
  const pages = usePages();
  const navigate = useNavigate();
  const index = useSearchIndex();
  const { onlyDrafts } = useDraftFilter();
  const [stored, setStored] = useStoredState<Partial<NodeFilter> | null>(`node-filter:${id}`, null);
  const filter = useMemo(() => normalizeFilter(stored, readOldWithSub()), [stored]);
  const setFilter = (f: NodeFilter) => setStored(f);
  const [newSub, setNewSub] = useState(false);
  const node = nodes.find((n) => n.id === id);

  const areaIds = useMemo(
    () => (node ? (filter.withSub ? new Set([node.id, ...descendantIds(nodes, node.id)]) : new Set([node.id])) : new Set<string>()),
    [node, nodes, filter.withSub],
  );
  const inArea = useMemo(() => pages.filter((p) => p.nodeIds.some((x) => areaIds.has(x))), [pages, areaIds]);

  const matchIds = useMemo(() => {
    if (!filter.q.trim()) return null;
    return new Set(
      index
        .search(filter.q)
        .map((r) => String(r.id))
        .filter((x) => x.startsWith('p:'))
        .map((x) => x.slice(2)),
    );
  }, [index, filter.q]);

  const shown = useMemo(() => {
    const f = applyFilter(inArea, filter, matchIds);
    return onlyDrafts ? f.filter((p) => p.status === 'draft') : f;
  }, [inArea, filter, matchIds, onlyDrafts]);

  const areaOf = (p: Page) => (node ? directAreaLabel(p, areaIds, nodes, node.id) : '');
  const sorted = useMemo(() => sortPages(shown, filter, areaOf), [shown, filter, areaIds, nodes]); // eslint-disable-line react-hooks/exhaustive-deps
  const marks = useMemo(() => availableMarks(shown, filter), [shown, filter]);

  const sportsMarks = useMemo(() => {
    if (node?.special !== 'sports') return [];
    const m = new Map<string, number>();
    for (const p of pages) for (const s of p.sports) m.set(s, (m.get(s) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
  }, [node, pages]);

  if (!nodes.length) return <p className="muted">Lädt …</p>;
  if (!node) return <p>Dieser Bereich existiert nicht (mehr).</p>;
  const path = pathOf(nodes, node.id);
  const kids = childrenOf(nodes, node.id);
  const active = filterActive(filter);

  return (
    <div className="screen">
      <div className="crumbs">
        {path.slice(0, -1).map((n) => (
          <span key={n.id}>
            <Link to={nodeUrl(n)}>{n.title}</Link> ›{' '}
          </span>
        ))}
      </div>
      <div className="page-head">
        <h1>{node.title}</h1>
        <button
          className="btn btn-primary"
          onClick={async () => {
            const pid = await createPage({ nodeIds: [node.id] });
            navigate(`/seite/${pid}?neu=1`);
          }}
        >
          + Neue Seite
        </button>
      </div>

      <section>
        <div className="section-head">
          <h3>Unterthemen</h3>
          <button className="btn btn-small btn-ghost" onClick={() => setNewSub(true)}>
            + Unterthema
          </button>
        </div>
        {kids.length ? (
          <div className="tiles">
            {kids.map((k) => (
              <Link key={k.id} to={nodeUrl(k)} className="tile">
                {k.title}
                {childrenOf(nodes, k.id).length > 0 && <small className="muted"> · {childrenOf(nodes, k.id).length} Unterthemen</small>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted small">Keine Unterthemen. Umbenennen, Verschieben usw. über „⋯“ im Themenbaum links.</p>
        )}
      </section>

      {node.special === 'sports' && (
        <section>
          <h3>Sportarten-Markierungen</h3>
          <p className="muted small">Automatisch: alle Sportarten, die auf Seiten markiert sind.</p>
          <div className="tiles">
            {sportsMarks.map(([s, c]) => (
              <Link key={s} to={markUrl('sport', s)} className="tile">
                {s} <small className="muted">· {c}</small>
              </Link>
            ))}
            {!sportsMarks.length && <p className="muted">Noch keine Sportarten markiert.</p>}
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <h3>Seiten</h3>
          {kids.length > 0 && (
            <label className="check">
              <input type="checkbox" checked={filter.withSub} onChange={(e) => setFilter({ ...filter, withSub: e.target.checked })} /> inkl. Unterthemen
            </label>
          )}
        </div>

        {inArea.length > 0 && <FilterBar filter={filter} setFilter={setFilter} marks={marks} />}

        {inArea.length > 0 && (
          <div className="filter-summary">
            <span className="muted small" aria-live="polite">
              {shown.length === inArea.length ? `${inArea.length} Seite${inArea.length === 1 ? '' : 'n'}` : `${shown.length} von ${inArea.length} Seiten`}
            </span>
            {active && (
              <button
                className="link-btn small"
                onClick={() => setFilter({ ...filter, marks: [], status: 'all', q: '' })}
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {!inArea.length ? (
          <p className="muted">Hier gibt es noch keine Seiten.</p>
        ) : !sorted.length ? (
          <p className="muted">
            {onlyDrafts && !active ? 'Keine Entwürfe hier (Filter „nur Entwürfe“ ist an).' : 'Keine Seite passt zu den gewählten Filtern.'}
          </p>
        ) : filter.view === 'list' ? (
          <PageList pages={sorted} keepOrder />
        ) : (
          <PageTable pages={sorted} filter={filter} setFilter={setFilter} areaOf={areaOf} />
        )}
      </section>

      {newSub && <PromptModal title={`Unterthema in „${node.title}“`} label="Name" okLabel="Anlegen" onOk={(t) => createNode(t, node.id)} onClose={() => setNewSub(false)} />}
    </div>
  );
}

const KIND_LABEL: Record<MarkKind, string> = { tag: 'Tags', region: 'Körperregion', sport: 'Sportart' };
const MAX_CHIPS = 12;

function FilterBar({
  filter,
  setFilter,
  marks,
}: {
  filter: NodeFilter;
  setFilter: (f: NodeFilter) => void;
  marks: Record<MarkKind, { value: string; count: number }[]>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Auf dem Handy sind Status- und Markierungsfilter anfangs eingeklappt (außer es ist schon etwas gewählt).
  const [open, setOpen] = useState(() => !window.matchMedia?.('(max-width: 520px)').matches || filter.marks.length > 0 || filter.status !== 'all');
  const kinds = (['tag', 'region', 'sport'] as MarkKind[]).filter((k) => marks[k].length > 0);
  const nActive = filter.marks.length + (filter.status !== 'all' ? 1 : 0);
  return (
    <div className={'filter-bar' + (open ? '' : ' collapsed')}>
      <div className="filter-row">
        <input
          className="input filter-search"
          type="search"
          placeholder="In diesem Bereich suchen …"
          aria-label="In diesem Bereich suchen"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
        />
        <div className="segmented" role="group" aria-label="Ansicht">
          <button className={filter.view === 'list' ? 'on' : ''} onClick={() => setFilter({ ...filter, view: 'list' })} aria-pressed={filter.view === 'list'}>
            ☰ Liste
          </button>
          <button className={filter.view === 'table' ? 'on' : ''} onClick={() => setFilter({ ...filter, view: 'table' })} aria-pressed={filter.view === 'table'}>
            ▦ Tabelle
          </button>
        </div>
      </div>
      <button className="filter-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Filter{nActive > 0 && <span className="filter-count">{nActive}</span>} <span className="muted">{open ? '▴' : '▾'}</span>
      </button>
      <div className="filter-row filter-more">
        <span className="filter-label">Status</span>
        <div className="segmented segmented-small" role="group" aria-label="Prüfstatus">
          {(
            [
              ['all', 'Alle'],
              ['draft', 'Nur Entwürfe'],
              ['reviewed', 'Nur geprüfte'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className={filter.status === v ? 'on' : ''} aria-pressed={filter.status === v} onClick={() => setFilter({ ...filter, status: v })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {kinds.map((k) => {
        const list = marks[k];
        const all = expanded[k] || list.length <= MAX_CHIPS;
        const visible = all ? list : list.filter((m, i) => i < MAX_CHIPS || isMarkSelected(filter, k, m.value));
        return (
          <div key={k} className="filter-row filter-marks filter-more">
            <span className="filter-label">{KIND_LABEL[k]}</span>
            <div className="filter-chips">
              {visible.map((m) => {
                const on = isMarkSelected(filter, k, m.value);
                return (
                  <button
                    key={m.value}
                    className={'chip chip-' + k + ' chip-toggle' + (on ? ' on' : '')}
                    aria-pressed={on}
                    onClick={() => setFilter(toggleMark(filter, k, m.value))}
                  >
                    {on && '✓ '}
                    {m.value}
                    <small>{m.count}</small>
                  </button>
                );
              })}
              {list.length > MAX_CHIPS && (
                <button className="link-btn small" onClick={() => setExpanded({ ...expanded, [k]: !expanded[k] })}>
                  {expanded[k] ? 'weniger' : `+ ${list.length - visible.length} weitere`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PageTable({
  pages,
  filter,
  setFilter,
  areaOf,
}: {
  pages: Page[];
  filter: NodeFilter;
  setFilter: (f: NodeFilter) => void;
  areaOf: (p: Page) => string;
}) {
  const head = (key: SortKey, label: string) => {
    const on = filter.sort.key === key;
    const dir = on ? filter.sort.dir : undefined;
    return (
      <th aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}>
        <button
          className="sort-btn"
          onClick={() => setFilter({ ...filter, sort: { key, dir: on && filter.sort.dir === 'asc' ? 'desc' : 'asc' } })}
        >
          {label}
          <span className="sort-arrow">{on ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
        </button>
      </th>
    );
  };
  return (
    <div className="table-wrap">
      <p className="muted small swipe-hint">Tipp: Tabelle seitlich wischen, um alle Spalten zu sehen.</p>
      <table className="tbl page-table">
        <thead>
          <tr>
            {head('title', 'Titel')}
            {head('area', 'Unterthema')}
            {head('marks', 'Markierungen')}
            {head('status', 'Status')}
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.id}>
              <td className="col-title">
                <Link to={`/seite/${p.id}`}>{p.title}</Link>
              </td>
              <td>{areaOf(p) || <span className="muted">direkt hier</span>}</td>
              <td>
                <span className="mark-chips">
                  {p.sports.map((s) => (
                    <span key={'s' + s} className="chip chip-sport">
                      {s}
                    </span>
                  ))}
                  {p.bodyRegions.map((s) => (
                    <span key={'r' + s} className="chip chip-region">
                      {s}
                    </span>
                  ))}
                  {p.tags.map((s) => (
                    <span key={'t' + s} className="chip chip-tag">
                      {s}
                    </span>
                  ))}
                </span>
              </td>
              <td>
                <StatusBadge status={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

