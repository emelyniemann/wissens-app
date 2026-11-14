import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { nodeUrl } from '../components/Tree';
import { markUrl, PageList, PromptModal } from '../components/ui';
import { useNodes, usePages, useStoredState } from '../hooks';
import { createPage } from '../pages';
import { childrenOf, createNode, descendantIds, pathOf } from '../tree';

export function NodeScreen() {
  const { id = '' } = useParams();
  const nodes = useNodes();
  const pages = usePages();
  const navigate = useNavigate();
  const [withSub, setWithSub] = useStoredState('node-with-sub', true);
  const [newSub, setNewSub] = useState(false);
  const node = nodes.find((n) => n.id === id);

  const list = useMemo(() => {
    if (!node) return [];
    const ids = withSub ? new Set([node.id, ...descendantIds(nodes, node.id)]) : new Set([node.id]);
    return pages.filter((p) => p.nodeIds.some((x) => ids.has(x)));
  }, [node, nodes, pages, withSub]);

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
              <input type="checkbox" checked={withSub} onChange={(e) => setWithSub(e.target.checked)} /> inkl. Unterthemen
            </label>
          )}
        </div>
        <PageList pages={list} empty="Hier gibt es noch keine Seiten." />
      </section>

      {newSub && <PromptModal title={`Unterthema in „${node.title}“`} label="Name" okLabel="Anlegen" onOk={(t) => createNode(t, node.id)} onClose={() => setNewSub(false)} />}
    </div>
  );
}
