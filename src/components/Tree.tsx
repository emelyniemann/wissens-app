import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useNodes, usePages, useStoredState } from '../hooks';
import { createPage } from '../pages';
import {
  childrenOf,
  createNode,
  deleteNode,
  descendantIds,
  indentNode,
  mergeNodes,
  moveNode,
  outdentNode,
  renameNode,
  shiftNode,
} from '../tree';
import type { TreeNode } from '../types';
import { ConfirmModal, NodePicker, PopMenu, PromptModal } from './ui';

type DropPos = 'before' | 'inside' | 'after';

export function nodeUrl(n: TreeNode) {
  return n.special === 'notes' ? '/notizen' : `/bereich/${n.id}`;
}

export function Tree({ onNavigate }: { onNavigate?: () => void }) {
  const nodes = useNodes();
  const pages = usePages();
  const [expanded, setExpanded] = useStoredState<string[]>('tree-expanded', []);
  const [drop, setDrop] = useState<{ id: string; pos: DropPos } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { kind: 'newRoot' }>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pages) for (const id of p.nodeIds) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const blocked = useMemo(() => (activeId ? new Set([activeId, ...descendantIds(nodes, activeId)]) : new Set<string>()), [activeId, nodes]);

  const onMove = (e: DragMoveEvent) => {
    const over = e.over;
    if (!over || blocked.has(String(over.id))) return setDrop(null);
    const ev = e.activatorEvent as PointerEvent & TouchEvent;
    const startY = ev.touches?.[0]?.clientY ?? ev.clientY ?? 0;
    const y = startY + e.delta.y;
    const r = over.rect;
    const ratio = (y - r.top) / r.height;
    const pos: DropPos = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'inside';
    setDrop({ id: String(over.id), pos });
  };

  const onEnd = async (_e: DragEndEvent) => {
    const a = activeId;
    const d = drop;
    setActiveId(null);
    setDrop(null);
    if (!a || !d) return;
    const target = nodes.find((n) => n.id === d.id);
    if (!target) return;
    if (d.pos === 'inside') {
      await moveNode(a, target.id, childrenOf(nodes, target.id).filter((n) => n.id !== a).length);
      if (!expanded.includes(target.id)) setExpanded([...expanded, target.id]);
    } else {
      const sib = childrenOf(nodes, target.parentId).filter((n) => n.id !== a);
      const idx = sib.findIndex((n) => n.id === target.id);
      await moveNode(a, target.parentId, d.pos === 'before' ? idx : idx + 1);
    }
  };

  const toggle = (id: string) => setExpanded(expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id]);

  const render = (parentId: string | null, depth: number) =>
    childrenOf(nodes, parentId).map((n) => {
      const kids = childrenOf(nodes, n.id);
      const open = expanded.includes(n.id);
      return (
        <li key={n.id}>
          <TreeRow
            node={n}
            depth={depth}
            hasKids={kids.length > 0}
            open={open}
            count={counts.get(n.id) ?? 0}
            onToggle={() => toggle(n.id)}
            drop={drop?.id === n.id ? drop.pos : null}
            dragging={activeId === n.id}
            onNavigate={onNavigate}
            onExpand={() => !open && toggle(n.id)}
          />
          {kids.length > 0 && open && <ul>{render(n.id, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <nav className="tree" aria-label="Themenbaum">
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragMove={onMove}
        onDragEnd={onEnd}
        onDragCancel={() => {
          setActiveId(null);
          setDrop(null);
        }}
      >
        <ul className="tree-root">{render(null, 0)}</ul>
      </DndContext>
      <button className="btn btn-small btn-ghost tree-add" onClick={() => setDialog({ kind: 'newRoot' })}>
        + Neuer Reiter
      </button>
      {dialog?.kind === 'newRoot' && (
        <PromptModal title="Neuer Reiter" label="Name" okLabel="Anlegen" onOk={(t) => createNode(t, null)} onClose={() => setDialog(null)} />
      )}
    </nav>
  );
}

type RowDialog = null | 'rename' | 'child' | 'move' | 'merge' | 'delete';

function TreeRow({
  node,
  depth,
  hasKids,
  open,
  count,
  onToggle,
  drop,
  dragging,
  onNavigate,
  onExpand,
}: {
  node: TreeNode;
  depth: number;
  hasKids: boolean;
  open: boolean;
  count: number;
  onToggle: () => void;
  drop: DropPos | null;
  dragging: boolean;
  onNavigate?: () => void;
  onExpand: () => void;
}) {
  const nodes = useNodes();
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef: dragRef } = useDraggable({ id: node.id });
  const { setNodeRef: dropRef } = useDroppable({ id: node.id });
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [dialog, setDialog] = useState<RowDialog>(null);
  const exclude = useMemo(() => new Set([node.id, ...descendantIds(nodes, node.id)]), [nodes, node.id]);

  const act = (fn: () => void) => () => fn();

  return (
    <div
      ref={(el) => {
        dragRef(el);
        dropRef(el);
      }}
      className={'tree-row' + (drop ? ' drop-' + drop : '') + (dragging ? ' dragging' : '')}
      style={{ paddingLeft: 6 + depth * 14 }}
    >
      <button className="tree-toggle" onClick={onToggle} aria-label={open ? 'Zuklappen' : 'Aufklappen'} style={{ visibility: hasKids ? 'visible' : 'hidden' }}>
        {open ? '▾' : '▸'}
      </button>
      <NavLink to={nodeUrl(node)} className={({ isActive }) => 'tree-link' + (isActive ? ' active' : '') + (depth === 0 ? ' root' : '')} onClick={onNavigate}>
        {node.title}
        {count > 0 && <span className="tree-count">{count}</span>}
      </NavLink>
      <span className="tree-menu-wrap">
        <button className="icon-btn tree-dots" onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())} aria-label={`Menü für ${node.title}`}>
          ⋯
        </button>
        {menu && (
          <PopMenu anchor={menu} onClose={() => setMenu(null)}>
              <button
                onClick={act(async () => {
                  const id = await createPage({ nodeIds: [node.id] });
                  onNavigate?.();
                  navigate(`/seite/${id}?neu=1`);
                })}
              >
                Neue Seite hier
              </button>
              <button onClick={act(() => setDialog('child'))}>Unterthema anlegen</button>
              <button onClick={act(() => setDialog('rename'))}>Umbenennen</button>
              <hr />
              <button onClick={act(() => shiftNode(node.id, -1))}>↑ Nach oben</button>
              <button onClick={act(() => shiftNode(node.id, 1))}>↓ Nach unten</button>
              <button onClick={act(() => indentNode(node.id))}>→ Einrücken (unter das Thema darüber)</button>
              <button onClick={act(() => outdentNode(node.id))} disabled={!node.parentId}>
                ← Ausrücken (eine Ebene höher)
              </button>
              <button onClick={act(() => setDialog('move'))}>Verschieben nach …</button>
              <button onClick={act(() => setDialog('merge'))}>Zusammenlegen mit …</button>
              <hr />
              <button className="danger" onClick={act(() => setDialog('delete'))}>
                Löschen …
              </button>
          </PopMenu>
        )}
      </span>
      <button className="icon-btn drag-handle" {...listeners} {...attributes} aria-label={`${node.title} verschieben (ziehen)`} title="Zum Verschieben ziehen">
        ⠿
      </button>

      {dialog === 'rename' && (
        <PromptModal title="Umbenennen" initial={node.title} okLabel="Speichern" onOk={(t) => renameNode(node.id, t)} onClose={() => setDialog(null)} />
      )}
      {dialog === 'child' && (
        <PromptModal
          title={`Unterthema in „${node.title}“`}
          label="Name"
          okLabel="Anlegen"
          onOk={async (t) => {
            await createNode(t, node.id);
            onExpand();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'move' && (
        <NodePicker
          title={`„${node.title}“ verschieben nach …`}
          allowRoot
          exclude={exclude}
          onPick={(id) => moveNode(node.id, id, childrenOf(nodes, id).length)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'merge' && (
        <NodePicker
          title={`„${node.title}“ zusammenlegen mit …`}
          exclude={exclude}
          onPick={(id) => id && mergeNodes(node.id, id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmModal
          title="Bereich löschen?"
          text={
            <>
              „{node.title}“ wird entfernt. <strong>Seiten bleiben erhalten</strong> (sie verlieren nur diese Zuordnung), Unterthemen rutschen eine Ebene nach oben.
            </>
          }
          okLabel="Löschen"
          onOk={() => deleteNode(node.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
