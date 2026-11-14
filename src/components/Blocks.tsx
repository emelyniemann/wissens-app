// Anzeige und Bearbeitung der einzelnen Bausteine einer Seite.
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { newId } from '../db';
import { useImageUrl, useNodes } from '../hooks';
import { storeImage } from '../images';
import { BLOCK_LABELS, createPage } from '../pages';
import type { Block, PageRefItem } from '../types';
import { PagePicker, renderInline, RichText, StatusBadge, useRichMaps } from './ui';

/* ================= Anzeige ================= */

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'text':
      return (
        <div className="blk blk-text">
          <RichText text={block.text} />
        </div>
      );
    case 'bullets':
      return (
        <div className="blk">
          <BulletList items={block.items} />
        </div>
      );
    case 'training':
      return (
        <div className="blk blk-training">
          <div className="blk-label">🎯 Bedeutung fürs Training</div>
          <RichText text={block.text} />
        </div>
      );
    case 'notes':
      return (
        <div className="blk blk-notes">
          <div className="blk-label">✎ Eigene Notizen</div>
          <RichText text={block.text} />
        </div>
      );
    case 'table':
      return (
        <div className="blk table-wrap">
          <TableView rows={block.rows} header={block.header} />
        </div>
      );
    case 'image':
      return <ImageView imageId={block.imageId} caption={block.caption} credit={block.credit} />;
    case 'exercises':
    case 'tests':
      return (
        <div className="blk">
          <div className="blk-label">{block.type === 'exercises' ? '🏋 Übungen' : '📋 Tests'}</div>
          <RefListView items={block.items} />
        </div>
      );
    case 'sources':
      return (
        <div className="blk blk-sources">
          <div className="blk-label">📚 Quellen</div>
          <ol>
            {block.items.map((s) => (
              <li key={s.id}>
                {s.text}
                {s.url && (
                  <>
                    {' '}
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Link
                    </a>
                  </>
                )}
                {s.stand && <span className="muted"> · Stand: {s.stand}</span>}
              </li>
            ))}
          </ol>
        </div>
      );
  }
}

function BulletList({ items }: { items: string[] }) {
  const { byId, byTitle } = useRichMaps();
  return (
    <ul className="bullets">
      {items.filter((i) => i.trim()).map((i, k) => (
        <li key={k}>
          <RichInline text={i} byId={byId} byTitle={byTitle} />
        </li>
      ))}
    </ul>
  );
}

function RichInline({ text, byId, byTitle }: { text: string; byId: any; byTitle: any }) {
  return <>{renderInline(text, byId, byTitle)}</>;
}

function TableView({ rows, header }: { rows: string[][]; header: boolean }) {
  const { byId, byTitle } = useRichMaps();
  const [head, ...body] = rows;
  const cell = (c: string) => renderInline(c, byId, byTitle);
  return (
    <table className="tbl">
      {header && head && (
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i}>{cell(c)}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {(header ? body : rows).map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{cell(c)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ImageView({ imageId, caption, credit }: { imageId: string | null; caption?: string; credit?: string }) {
  const url = useImageUrl(imageId);
  return (
    <figure className="blk blk-image">
      {url ? <img src={url} alt={caption || 'Abbildung'} /> : <div className="img-missing">Kein Bild</div>}
      {(caption || credit) && (
        <figcaption>
          {caption}
          {credit && <span className="muted"> — Quelle: {credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function RefListView({ items }: { items: PageRefItem[] }) {
  const { byId } = useRichMaps();
  if (!items.length) return <p className="muted">Noch nichts verknüpft.</p>;
  return (
    <ul className="ref-list">
      {items.map((it) => {
        const p = byId.get(it.pageId);
        return (
          <li key={it.id}>
            {p ? (
              <Link to={`/seite/${p.id}`} className="int-link">
                {p.title}
              </Link>
            ) : (
              <span className="int-link missing">(Seite gelöscht)</span>
            )}
            {p && <StatusBadge status={p.status} />}
            {it.comment && <span className="muted"> – {it.comment}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ================= Bearbeitung ================= */

/** Mehrzeiliges Textfeld, das mitwächst, mit Knopf zum Einfügen eines internen Links. */
export function SmartTextarea({ value, onChange, placeholder, pageId }: { value: string; onChange: (v: string) => void; placeholder?: string; pageId?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pick, setPick] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 2 + 'px';
    }
  }, [value]);
  const insert = (s: string) => {
    const el = ref.current;
    const a = el?.selectionStart ?? value.length;
    const b = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, a) + s + value.slice(b));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(a + s.length, a + s.length);
    });
  };
  const wrap = (mark: string) => {
    const el = ref.current;
    const a = el?.selectionStart ?? 0;
    const b = el?.selectionEnd ?? 0;
    const sel = value.slice(a, b) || 'Text';
    onChange(value.slice(0, a) + mark + sel + mark + value.slice(b));
  };
  return (
    <div className="smart-ta">
      <div className="ta-tools">
        <button type="button" className="btn btn-small" onClick={() => wrap('**')} title="Fett">
          <strong>F</strong>
        </button>
        <button type="button" className="btn btn-small" onClick={() => wrap('*')} title="Kursiv">
          <em>K</em>
        </button>
        <button type="button" className="btn btn-small" onClick={() => setPick(true)}>
          🔗 Link zu Seite
        </button>
      </div>
      <textarea ref={ref} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} rows={3} />
      {value.includes('[[') && (
        <div className="ta-preview">
          <small className="muted">Vorschau:</small>
          <RichText text={value} />
        </div>
      )}
      {pick && <PagePicker title="Link einfügen zu …" excludeId={pageId} onPick={(p) => insert(`[[${p.id}|${p.title}]]`)} onClose={() => setPick(false)} />}
    </div>
  );
}

export function BlockEditor({ block, onChange, pageId }: { block: Block; onChange: (b: Block) => void; pageId: string }) {
  switch (block.type) {
    case 'text':
    case 'training':
    case 'notes':
      return (
        <SmartTextarea
          pageId={pageId}
          value={block.text}
          onChange={(text) => onChange({ ...block, text })}
          placeholder={
            block.type === 'training' ? 'Was bedeutet das konkret fürs Training?' : block.type === 'notes' ? 'Eigene Gedanken, Erfahrungen …' : 'Text … (Leerzeile = neuer Absatz)'
          }
        />
      );
    case 'bullets':
      return (
        <>
          <SmartTextarea pageId={pageId} value={block.items.join('\n')} onChange={(t) => onChange({ ...block, items: t.split('\n') })} placeholder="Ein Stichpunkt pro Zeile" />
          <small className="muted">Ein Stichpunkt pro Zeile.</small>
        </>
      );
    case 'table':
      return <TableEditor block={block} onChange={onChange} />;
    case 'image':
      return <ImageEditor block={block} onChange={onChange} />;
    case 'exercises':
    case 'tests':
      return <RefEditor block={block} onChange={onChange} pageId={pageId} />;
    case 'sources':
      return (
        <div className="src-edit">
          {block.items.map((s, i) => {
            const set = (patch: Partial<typeof s>) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={s.id} className="src-row">
                <textarea className="input" rows={2} placeholder="Autor:innen (Jahr). Titel. Zeitschrift …" value={s.text} onChange={(e) => set({ text: e.target.value })} />
                <div className="row">
                  <input className="input" placeholder="Web-Adresse / DOI (optional)" value={s.url ?? ''} onChange={(e) => set({ url: e.target.value })} />
                  <input className="input input-short" placeholder="Stand, z. B. 2024-05" value={s.stand ?? ''} onChange={(e) => set({ stand: e.target.value })} />
                  <button className="icon-btn" aria-label="Quelle entfernen" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
          <button className="btn btn-small" onClick={() => onChange({ ...block, items: [...block.items, { id: newId(), text: '', stand: new Date().toISOString().slice(0, 7) }] })}>
            + Quelle
          </button>
        </div>
      );
  }
}

function TableEditor({ block, onChange }: { block: Extract<Block, { type: 'table' }>; onChange: (b: Block) => void }) {
  const cols = Math.max(1, ...block.rows.map((r) => r.length));
  const rows = block.rows.map((r) => [...r, ...Array(cols - r.length).fill('')]);
  const set = (rows: string[][]) => onChange({ ...block, rows });
  return (
    <div>
      <div className="table-wrap">
        <table className="tbl tbl-edit">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={block.header && i === 0 ? 'head-row' : ''}>
                {r.map((c, j) => (
                  <td key={j}>
                    <input value={c} onChange={(e) => set(rows.map((rr, ii) => (ii === i ? rr.map((cc, jj) => (jj === j ? e.target.value : cc)) : rr)))} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row wrap">
        <button className="btn btn-small" onClick={() => set([...rows, Array(cols).fill('')])}>
          + Zeile
        </button>
        <button className="btn btn-small" onClick={() => set(rows.map((r) => [...r, '']))}>
          + Spalte
        </button>
        <button className="btn btn-small" disabled={rows.length <= 1} onClick={() => set(rows.slice(0, -1))}>
          − Zeile
        </button>
        <button className="btn btn-small" disabled={cols <= 1} onClick={() => set(rows.map((r) => r.slice(0, -1)))}>
          − Spalte
        </button>
        <label className="check">
          <input type="checkbox" checked={block.header} onChange={(e) => onChange({ ...block, header: e.target.checked })} /> Erste Zeile ist Überschrift
        </label>
      </div>
    </div>
  );
}

function ImageEditor({ block, onChange }: { block: Extract<Block, { type: 'image' }>; onChange: (b: Block) => void }) {
  const url = useImageUrl(block.imageId);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="img-edit">
      {url ? <img src={url} alt="" className="img-preview" /> : <div className="img-missing">Noch kein Bild gewählt</div>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          const id = await storeImage(f, block.credit ?? '');
          setBusy(false);
          onChange({ ...block, imageId: id });
          e.target.value = '';
        }}
      />
      <button className="btn btn-small" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? 'Wird gespeichert …' : url ? 'Anderes Bild wählen' : '🖼 Bild auswählen'}
      </button>
      <input className="input" placeholder="Bildunterschrift" value={block.caption ?? ''} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
      <input className="input" placeholder="Quelle & Lizenz (z. B. „eigenes Foto“ oder „Wikimedia Commons, CC BY-SA 4.0, Urheber:in …“)" value={block.credit ?? ''} onChange={(e) => onChange({ ...block, credit: e.target.value })} />
    </div>
  );
}

function RefEditor({ block, onChange, pageId }: { block: Extract<Block, { type: 'exercises' | 'tests' }>; onChange: (b: Block) => void; pageId: string }) {
  const { byId } = useRichMaps();
  const nodes = useNodes();
  const navigate = useNavigate();
  const [pick, setPick] = useState(false);
  const isEx = block.type === 'exercises';
  const rootTitle = isEx ? 'Übungen' : 'Diagnostik & Tests';
  const add = (pid: string) => onChange({ ...block, items: [...block.items, { id: newId(), pageId: pid, comment: '' }] });
  return (
    <div>
      {block.items.map((it, i) => (
        <div key={it.id} className="row ref-row">
          <span className="ref-title">{byId.get(it.pageId)?.title ?? '(Seite gelöscht)'}</span>
          <input
            className="input"
            placeholder="Kommentar (optional)"
            value={it.comment ?? ''}
            onChange={(e) => onChange({ ...block, items: block.items.map((x, j) => (j === i ? { ...x, comment: e.target.value } : x)) })}
          />
          <button className="icon-btn" aria-label="Verweis entfernen" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <div className="row wrap">
        <button className="btn btn-small" onClick={() => setPick(true)}>
          + {isEx ? 'Übung' : 'Test'} verknüpfen
        </button>
        <button
          className="btn btn-small btn-ghost"
          onClick={async () => {
            const root = nodes.find((n) => n.parentId === null && n.title === rootTitle);
            const id = await createPage({ title: isEx ? 'Neue Übung' : 'Neuer Test', nodeIds: root ? [root.id] : [] });
            add(id);
            setTimeout(() => navigate(`/seite/${id}?neu=1`), 100);
          }}
        >
          + neue {isEx ? 'Übungsseite' : 'Testseite'} anlegen
        </button>
      </div>
      {pick && <PagePicker title={isEx ? 'Übung verknüpfen' : 'Test verknüpfen'} excludeId={pageId} onPick={(p) => add(p.id)} onClose={() => setPick(false)} />}
    </div>
  );
}

export function BlockFrame({ label, children, tools }: { label: string; children: ReactNode; tools: ReactNode }) {
  return (
    <div className="blk-frame">
      <div className="blk-frame-head">
        {tools}
        <span className="blk-frame-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

export { BLOCK_LABELS };
