import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useNodes, usePages } from '../hooks';
import { pathLabel } from '../tree';
import type { Page, ReviewStatus } from '../types';

/* ---------- Filter „nur Entwürfe“ (gilt überall) ---------- */
export const DraftFilterContext = createContext<{ onlyDrafts: boolean; setOnlyDrafts: (v: boolean) => void }>({
  onlyDrafts: false,
  setOnlyDrafts: () => {},
});
export const useDraftFilter = () => useContext(DraftFilterContext);

/* ---------- Dialogfenster ---------- */
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Aufklappmenü (schwebt über allem) ---------- */
export function PopMenu({ anchor, onClose, children }: { anchor: DOMRect; onClose: () => void; children: ReactNode }) {
  const width = 260;
  const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
  const below = anchor.bottom + 4;
  const fitsBelow = below + 380 < window.innerHeight;
  const style = fitsBelow ? { left, top: below, width } : { left, bottom: window.innerHeight - anchor.top + 4, width };
  return createPortal(
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="menu" role="menu" style={style} onClick={onClose}>
        {children}
      </div>
    </>,
    document.body,
  );
}

/* ---------- Eingabe-Dialog (statt window.prompt, funktioniert auch als App) ---------- */
export function PromptModal({
  title,
  label,
  initial = '',
  okLabel = 'OK',
  onOk,
  onClose,
}: {
  title: string;
  label?: string;
  initial?: string;
  okLabel?: string;
  onOk: (v: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (v.trim()) {
            onOk(v.trim());
            onClose();
          }
        }}
      >
        {label && <label className="field-label">{label}</label>}
        <input ref={ref} className="input" value={v} onChange={(e) => setV(e.target.value)} />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary">
            {okLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ConfirmModal({ title, text, okLabel = 'Ja', onOk, onClose }: { title: string; text: ReactNode; okLabel?: string; onOk: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{text}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            onOk();
            onClose();
          }}
        >
          {okLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Seite auswählen ---------- */
export function PagePicker({ title, onPick, onClose, excludeId }: { title: string; onPick: (p: Page) => void; onClose: () => void; excludeId?: string }) {
  const pages = usePages();
  const nodes = useNodes();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const nq = q.toLocaleLowerCase('de');
    return pages
      .filter((p) => p.id !== excludeId && p.title.toLocaleLowerCase('de').includes(nq))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'))
      .slice(0, 80);
  }, [pages, q, excludeId]);
  return (
    <Modal title={title} onClose={onClose}>
      <input autoFocus className="input" placeholder="Seite suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="pick-list">
        {list.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => {
                onPick(p);
                onClose();
              }}
            >
              <strong>{p.title}</strong>
              <small>{p.nodeIds.map((id) => pathLabel(nodes, id)).join(' · ') || 'ohne Zuordnung'}</small>
            </button>
          </li>
        ))}
        {!list.length && <li className="muted">Keine passende Seite.</li>}
      </ul>
    </Modal>
  );
}

/* ---------- Bereich (Baumknoten) auswählen ---------- */
export function NodePicker({
  title,
  onPick,
  onClose,
  exclude,
  allowRoot,
}: {
  title: string;
  onPick: (id: string | null) => void;
  onClose: () => void;
  exclude?: Set<string>;
  allowRoot?: boolean;
}) {
  const nodes = useNodes();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const nq = q.toLocaleLowerCase('de');
    return nodes
      .filter((n) => !exclude?.has(n.id))
      .map((n) => ({ id: n.id, label: pathLabel(nodes, n.id) }))
      .filter((x) => x.label.toLocaleLowerCase('de').includes(nq))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [nodes, q, exclude]);
  return (
    <Modal title={title} onClose={onClose}>
      <input autoFocus className="input" placeholder="Bereich suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="pick-list">
        {allowRoot && (
          <li>
            <button
              onClick={() => {
                onPick(null);
                onClose();
              }}
            >
              <strong>Oberste Ebene (als eigener Reiter)</strong>
            </button>
          </li>
        )}
        {list.map((x) => (
          <li key={x.id}>
            <button
              onClick={() => {
                onPick(x.id);
                onClose();
              }}
            >
              {x.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/* ---------- Markierungen als Chips eingeben ---------- */
export function ChipInput({ values, onChange, suggestions, placeholder }: { values: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder?: string }) {
  const [v, setV] = useState('');
  const listId = useMemo(() => 'dl-' + Math.random().toString(36).slice(2), []);
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim();
    if (t && !values.some((x) => x.toLocaleLowerCase('de') === t.toLocaleLowerCase('de'))) onChange([...values, t]);
    setV('');
  };
  return (
    <div className="chip-input">
      {values.map((x) => (
        <span key={x} className="chip">
          {x}
          <button aria-label={`${x} entfernen`} onClick={() => onChange(values.filter((y) => y !== x))}>
            ✕
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={v}
        placeholder={placeholder}
        onChange={(e) => {
          const val = e.target.value;
          if (val.endsWith(',')) add(val);
          else setV(val);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(v);
          } else if (e.key === 'Backspace' && !v && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => v.trim() && add(v)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !values.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return status === 'reviewed' ? <span className="badge badge-ok">Geprüft</span> : <span className="badge badge-draft">Entwurf (KI)</span>;
}

export const MARK_KINDS = {
  sport: { label: 'Sportart', field: 'sports' as const },
  region: { label: 'Körperregion', field: 'bodyRegions' as const },
  tag: { label: 'Tag', field: 'tags' as const },
};
export type MarkKind = keyof typeof MARK_KINDS;

export function markUrl(kind: MarkKind, value: string) {
  return `/markierung/${kind}/${encodeURIComponent(value)}`;
}

export function MarkChips({ page }: { page: Page }) {
  const all: [MarkKind, string][] = [
    ...page.sports.map((s) => ['sport', s] as [MarkKind, string]),
    ...page.bodyRegions.map((s) => ['region', s] as [MarkKind, string]),
    ...page.tags.map((s) => ['tag', s] as [MarkKind, string]),
  ];
  if (!all.length) return null;
  return (
    <span className="mark-chips">
      {all.map(([k, v]) => (
        <Link key={k + v} to={markUrl(k, v)} className={'chip chip-' + k} title={MARK_KINDS[k].label}>
          {v}
        </Link>
      ))}
    </span>
  );
}

/* ---------- Liste von Seiten ---------- */
export function PageList({ pages, empty = 'Noch keine Seiten.', keepOrder }: { pages: Page[]; empty?: string; keepOrder?: boolean }) {
  const { onlyDrafts } = useDraftFilter();
  const nodes = useNodes();
  const filtered = onlyDrafts ? pages.filter((p) => p.status === 'draft') : pages;
  const shown = keepOrder ? filtered : filtered.slice().sort((a, b) => a.title.localeCompare(b.title, 'de'));
  if (!shown.length) return <p className="muted">{onlyDrafts && pages.length ? 'Keine Entwürfe hier (Filter „nur Entwürfe“ ist an).' : empty}</p>;
  return (
    <ul className="page-list">
      {shown.map((p) => (
        <li key={p.id}>
          <Link to={`/seite/${p.id}`} className="page-card">
            <div className="page-card-top">
              <strong>{p.title}</strong>
              <StatusBadge status={p.status} />
            </div>
            <small className="muted">{p.nodeIds.map((id) => pathLabel(nodes, id)).join(' · ') || 'ohne Zuordnung'}</small>
          </Link>
          <MarkChips page={p} />
        </li>
      ))}
    </ul>
  );
}

/* ---------- Text mit einfacher Formatierung und internen Links ----------
   **fett**, *kursiv*, [[Seiten-ID|Titel]] oder [[Titel]], Web-Adressen. */
export function RichText({ text }: { text: string }) {
  const pages = usePages();
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const byTitle = useMemo(() => new Map(pages.map((p) => [p.title.toLocaleLowerCase('de'), p])), [pages]);
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, i) => (
        <p key={i}>
          {para.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {renderInline(line, byId, byTitle)}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}

export function renderInline(line: string, byId: Map<string, Page>, byTitle: Map<string, Page>): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let k = 0;
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(line.slice(last, idx));
    if (m[1] !== undefined) {
      const target = byId.get(m[1]) ?? byTitle.get((m[2] === undefined ? m[1] : m[2]).trim().toLocaleLowerCase('de'));
      const label = target?.title ?? m[2] ?? m[1];
      out.push(
        target ? (
          <Link key={k++} to={`/seite/${target.id}`} className="int-link">
            {label}
          </Link>
        ) : (
          <span key={k++} className="int-link missing" title="Diese Seite gibt es (noch) nicht">
            {label}
          </span>
        ),
      );
    } else if (m[3] !== undefined) out.push(<strong key={k++}>{m[3]}</strong>);
    else if (m[4] !== undefined) out.push(<em key={k++}>{m[4]}</em>);
    else if (m[5] !== undefined)
      out.push(
        <a key={k++} href={m[5]} target="_blank" rel="noreferrer">
          {m[5]}
        </a>,
      );
    last = idx + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

export function useRichMaps() {
  const pages = usePages();
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const byTitle = useMemo(() => new Map(pages.map((p) => [p.title.toLocaleLowerCase('de'), p])), [pages]);
  return { byId, byTitle };
}
