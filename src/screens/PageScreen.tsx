import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BlockEditor, BlockView } from '../components/Blocks';
import { ChipInput, ConfirmModal, MarkChips, NodePicker, StatusBadge } from '../components/ui';
import { db } from '../db';
import { useNodes, usePages } from '../hooks';
import { BLOCK_LABELS, BLOCK_ORDER, newBlock, outgoingLinks, savePage, softDeletePage } from '../pages';
import { pathOf } from '../tree';
import type { Block, Page } from '../types';
import { nodeUrl } from '../components/Tree';

export function PageScreen() {
  const { id = '' } = useParams();
  return <PageScreenInner key={id} id={id} />;
}

function PageScreenInner({ id }: { id: string }) {
  const page = useLiveQuery(() => db.pages.get(id), [id]);
  const [params, setParams] = useSearchParams();
  const editing = params.get('neu') === '1' || params.get('bearbeiten') === '1';
  const setEditing = (v: boolean) => setParams(v ? { bearbeiten: '1' } : {}, { replace: true });

  if (page === undefined) return <p className="muted">Lädt …</p>;
  if (!page) return <p>Diese Seite gibt es nicht.</p>;
  if (page.deletedAt !== null)
    return (
      <div className="screen">
        <p>Diese Seite liegt im Papierkorb.</p>
        <Link to="/daten" className="btn">
          Zum Papierkorb
        </Link>
      </div>
    );
  return editing ? <PageEditor initial={page} onDone={() => setEditing(false)} isNew={params.get('neu') === '1'} /> : <PageRead page={page} onEdit={() => setEditing(true)} />;
}

function Areas({ page }: { page: Page }) {
  const nodes = useNodes();
  if (!page.nodeIds.length) return <span className="muted">ohne Zuordnung</span>;
  return (
    <span className="areas">
      {page.nodeIds.map((nid) => {
        const path = pathOf(nodes, nid);
        if (!path.length) return null;
        return (
          <span key={nid} className="crumb">
            {path.map((n, i) => (
              <span key={n.id}>
                {i > 0 && ' › '}
                <Link to={nodeUrl(n)}>{n.title}</Link>
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}

function PageRead({ page, onEdit }: { page: Page; onEdit: () => void }) {
  const pages = usePages();
  const backlinks = useMemo(() => {
    const t = page.title.toLocaleLowerCase('de');
    return pages.filter((p) => {
      if (p.id === page.id) return false;
      const l = outgoingLinks(p);
      return l.ids.includes(page.id) || l.titles.includes(t);
    });
  }, [pages, page.id, page.title]);
  return (
    <article className="screen page">
      <div className="page-meta">
        <Areas page={page} />
      </div>
      <div className="page-head">
        <h1>{page.title}</h1>
        <button className="btn btn-primary" onClick={onEdit}>
          ✎ Bearbeiten
        </button>
      </div>
      <div className="page-tags">
        <StatusBadge status={page.status} />
        <MarkChips page={page} />
      </div>
      {page.blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
      {!page.blocks.length && <p className="muted">Diese Seite hat noch keine Bausteine. Tippe auf „Bearbeiten“.</p>}
      {backlinks.length > 0 && (
        <section className="backlinks">
          <h4>Verweise auf diese Seite</h4>
          <ul>
            {backlinks.map((p) => (
              <li key={p.id}>
                <Link to={`/seite/${p.id}`} className="int-link">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted small">Zuletzt geändert: {new Date(page.updatedAt).toLocaleString('de-DE')}</p>
    </article>
  );
}

function SortableBlock({ block, index, count, onChange, onMove, onRemove, pageId }: { block: Block; index: number; count: number; onChange: (b: Block) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; pageId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={'blk-frame' + (isDragging ? ' dragging' : '') + (block.type === 'training' ? ' frame-training' : '')}>
      <div className="blk-frame-head">
        <button className="icon-btn drag-handle" {...listeners} {...attributes} aria-label="Baustein verschieben (ziehen)" title="Zum Verschieben ziehen">
          ⠿
        </button>
        <span className="blk-frame-label">{BLOCK_LABELS[block.type]}</span>
        <span className="spacer" />
        <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Nach oben">
          ↑
        </button>
        <button className="icon-btn" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Nach unten">
          ↓
        </button>
        <button className="icon-btn" onClick={onRemove} aria-label="Baustein entfernen">
          🗑
        </button>
      </div>
      <BlockEditor block={block} onChange={onChange} pageId={pageId} />
    </div>
  );
}

function PageEditor({ initial, onDone, isNew }: { initial: Page; onDone: () => void; isNew: boolean }) {
  const [draft, setDraftState] = useState<Page>(initial);
  const latest = useRef(draft);
  const dirty = useRef(false);
  const timer = useRef<number>();
  const [saved, setSaved] = useState(true);
  const [pickArea, setPickArea] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [removeBlock, setRemoveBlock] = useState<string | null>(null);
  const pages = usePages();
  const nodes = useNodes();
  const navigate = useNavigate();
  const titleRef = useRef<HTMLInputElement>(null);

  const flush = async () => {
    window.clearTimeout(timer.current);
    if (dirty.current) {
      dirty.current = false;
      await savePage(latest.current);
      setSaved(true);
    }
  };
  const setDraft = (fn: (p: Page) => Page) => {
    const next = fn(latest.current);
    latest.current = next;
    dirty.current = true;
    setDraftState(next);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 400);
  };
  useEffect(() => {
    if (isNew) titleRef.current?.select();
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggest = useMemo(() => {
    const s = new Set<string>(),
      r = new Set<string>(),
      t = new Set<string>();
    for (const p of pages) {
      p.sports.forEach((x) => s.add(x));
      p.bodyRegions.forEach((x) => r.add(x));
      p.tags.forEach((x) => t.add(x));
    }
    for (const n of nodes) {
      const sportsRoot = nodes.find((x) => x.special === 'sports');
      if (sportsRoot && n.parentId === sportsRoot.id) s.add(n.title);
    }
    ['Ganzkörper', 'Schulter', 'Ellenbogen', 'Hand', 'Wirbelsäule', 'Rumpf', 'Hüfte', 'Knie', 'Sprunggelenk', 'Fuß', 'Oberschenkel', 'Unterschenkel'].forEach((x) => r.add(x));
    const sort = (x: Set<string>) => [...x].sort((a, b) => a.localeCompare(b, 'de'));
    return { sports: sort(s), regions: sort(r), tags: sort(t) };
  }, [pages, nodes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setDraft((p) => {
      const from = p.blocks.findIndex((b) => b.id === e.active.id);
      const to = p.blocks.findIndex((b) => b.id === e.over!.id);
      return { ...p, blocks: arrayMove(p.blocks, from, to) };
    });
  };

  const updateBlock = (b: Block) => setDraft((p) => ({ ...p, blocks: p.blocks.map((x) => (x.id === b.id ? b : x)) }));
  const moveBlock = (i: number, d: -1 | 1) => setDraft((p) => ({ ...p, blocks: arrayMove(p.blocks, i, i + d) }));

  return (
    <div className="screen page editing">
      <div className="edit-bar">
        <span className={'save-state' + (saved ? '' : ' pending')}>{saved ? '✓ Gespeichert' : 'Speichert …'}</span>
        <span className="spacer" />
        <button className="btn btn-danger-ghost" onClick={() => setConfirmDel(true)}>
          Seite löschen
        </button>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await flush();
            onDone();
          }}
        >
          Fertig
        </button>
      </div>

      <input ref={titleRef} className="input title-input" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Titel der Seite" aria-label="Titel" />

      <div className="frame-fields">
        <div className="field">
          <span className="field-label">Zuordnung(en)</span>
          <div className="chip-input">
            {draft.nodeIds.map((nid) => (
              <span key={nid} className="chip">
                {pathOf(nodes, nid).map((n) => n.title).join(' › ') || '(gelöscht)'}
                <button aria-label="Zuordnung entfernen" onClick={() => setDraft((p) => ({ ...p, nodeIds: p.nodeIds.filter((x) => x !== nid) }))}>
                  ✕
                </button>
              </span>
            ))}
            <button className="btn btn-small" onClick={() => setPickArea(true)}>
              + Bereich
            </button>
          </div>
        </div>
        <div className="field">
          <span className="field-label">Sportarten</span>
          <ChipInput values={draft.sports} onChange={(v) => setDraft((p) => ({ ...p, sports: v }))} suggestions={suggest.sports} placeholder="z. B. Fußball, Enter" />
        </div>
        <div className="field">
          <span className="field-label">Körperregion</span>
          <ChipInput values={draft.bodyRegions} onChange={(v) => setDraft((p) => ({ ...p, bodyRegions: v }))} suggestions={suggest.regions} placeholder="z. B. Knie, Enter" />
        </div>
        <div className="field">
          <span className="field-label">Tags</span>
          <ChipInput values={draft.tags} onChange={(v) => setDraft((p) => ({ ...p, tags: v }))} suggestions={suggest.tags} placeholder="freie Stichworte, Enter" />
        </div>
        <div className="field">
          <span className="field-label">Prüfstatus</span>
          <div className="segmented">
            <button className={draft.status === 'draft' ? 'on' : ''} onClick={() => setDraft((p) => ({ ...p, status: 'draft' }))}>
              Entwurf (KI)
            </button>
            <button className={draft.status === 'reviewed' ? 'on' : ''} onClick={() => setDraft((p) => ({ ...p, status: 'reviewed' }))}>
              Geprüft
            </button>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={draft.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {draft.blocks.map((b, i) => (
            <SortableBlock
              key={b.id}
              block={b}
              index={i}
              count={draft.blocks.length}
              pageId={draft.id}
              onChange={updateBlock}
              onMove={(d) => moveBlock(i, d)}
              onRemove={() => setRemoveBlock(b.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="add-blocks">
        <span className="field-label">Baustein hinzufügen</span>
        <div className="row wrap">
          {BLOCK_ORDER.map((t) => (
            <button key={t} className={'btn btn-small' + (t === 'training' ? ' btn-accent' : '')} onClick={() => setDraft((p) => ({ ...p, blocks: [...p.blocks, newBlock(t)] }))}>
              + {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
        <p className="muted small">Tipp: **fett**, *kursiv*. Links zu anderen Seiten über „🔗 Link zu Seite“ – sie bleiben auch nach Umbenennen gültig.</p>
      </div>

      {pickArea && (
        <NodePicker
          title="Bereich zuordnen"
          exclude={new Set(draft.nodeIds)}
          onPick={(nid) => nid && setDraft((p) => ({ ...p, nodeIds: [...p.nodeIds, nid] }))}
          onClose={() => setPickArea(false)}
        />
      )}
      {removeBlock && (
        <ConfirmModal
          title="Baustein entfernen?"
          text="Der Inhalt dieses Bausteins wird von der Seite entfernt."
          okLabel="Entfernen"
          onOk={() => setDraft((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== removeBlock) }))}
          onClose={() => setRemoveBlock(null)}
        />
      )}
      {confirmDel && (
        <ConfirmModal
          title="Seite löschen?"
          text="Die Seite kommt in den Papierkorb (unter „Sicherung & Daten“) und kann dort wiederhergestellt werden."
          okLabel="In den Papierkorb"
          onOk={async () => {
            await flush();
            await softDeletePage(draft.id);
            navigate(-1);
          }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}
