// Alles rund um den Themenbaum: anlegen, umbenennen, verschieben,
// zusammenlegen, löschen. Seiten verweisen per ID auf Knoten – deshalb
// geht beim Umbenennen oder Verschieben nichts verloren.
import { alive, base, db, now } from './db';
import type { TreeNode } from './types';

export async function liveNodes(): Promise<TreeNode[]> {
  return (await db.nodes.toArray()).filter((n) => n.deletedAt === null);
}

export function childrenOf(nodes: TreeNode[], parentId: string | null): TreeNode[] {
  return nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);
}

/** Pfad von der Wurzel bis zum Knoten, z. B. [Training, Motorische Fähigkeiten, Kraft]. */
export function pathOf(nodes: TreeNode[], id: string): TreeNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: TreeNode[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 100) {
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}

export function pathLabel(nodes: TreeNode[], id: string): string {
  return pathOf(nodes, id).map((n) => n.title).join(' › ');
}

/** Alle Nachfahren (Kinder, Enkel, …) eines Knotens. */
export function descendantIds(nodes: TreeNode[], id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of nodes) {
      if (n.parentId === cur && !out.has(n.id)) {
        out.add(n.id);
        stack.push(n.id);
      }
    }
  }
  return out;
}

export async function createNode(title: string, parentId: string | null): Promise<string> {
  const nodes = await liveNodes();
  const siblings = childrenOf(nodes, parentId);
  const order = siblings.length ? siblings[siblings.length - 1].order + 1 : 0;
  const node: TreeNode = { ...base(), title: title.trim() || 'Neues Thema', parentId, order };
  await db.nodes.add(node);
  return node.id;
}

export async function renameNode(id: string, title: string) {
  const t = title.trim();
  if (!t) return;
  await db.nodes.update(id, { title: t, updatedAt: now() });
}

/**
 * Verschiebt einen Knoten unter einen neuen Elternknoten an Position "index".
 * Verhindert, dass ein Knoten in sich selbst geschoben wird.
 */
export async function moveNode(id: string, newParentId: string | null, index: number) {
  await db.transaction('rw', db.nodes, async () => {
    const nodes = await liveNodes();
    if (newParentId === id) return;
    if (newParentId && descendantIds(nodes, id).has(newParentId)) return;
    const siblings = childrenOf(nodes, newParentId).filter((n) => n.id !== id);
    const i = Math.max(0, Math.min(index, siblings.length));
    const me = nodes.find((n) => n.id === id);
    if (!me) return;
    siblings.splice(i, 0, me);
    const t = now();
    for (let k = 0; k < siblings.length; k++) {
      const s = siblings[k];
      if (s.id === id) {
        await db.nodes.update(id, { parentId: newParentId, order: k, updatedAt: t });
      } else if (s.order !== k) {
        await db.nodes.update(s.id, { order: k, updatedAt: t });
      }
    }
  });
}

/** Eine Stufe nach oben/unten unter den Geschwistern. */
export async function shiftNode(id: string, delta: -1 | 1) {
  const nodes = await liveNodes();
  const me = nodes.find((n) => n.id === id);
  if (!me) return;
  const sib = childrenOf(nodes, me.parentId);
  const idx = sib.findIndex((n) => n.id === id);
  await moveNode(id, me.parentId, idx + delta);
}

/** Einrücken: wird Unterthema des Geschwisters darüber. */
export async function indentNode(id: string) {
  const nodes = await liveNodes();
  const me = nodes.find((n) => n.id === id);
  if (!me) return;
  const sib = childrenOf(nodes, me.parentId);
  const idx = sib.findIndex((n) => n.id === id);
  if (idx <= 0) return;
  const newParent = sib[idx - 1];
  await moveNode(id, newParent.id, childrenOf(nodes, newParent.id).length);
}

/** Ausrücken: wird Geschwister des bisherigen Elternknotens. */
export async function outdentNode(id: string) {
  const nodes = await liveNodes();
  const me = nodes.find((n) => n.id === id);
  if (!me || !me.parentId) return;
  const parent = nodes.find((n) => n.id === me.parentId);
  if (!parent) return;
  const sib = childrenOf(nodes, parent.parentId);
  const idx = sib.findIndex((n) => n.id === parent.id);
  await moveNode(id, parent.parentId, idx + 1);
}

/**
 * Legt "sourceId" mit "targetId" zusammen: Unterthemen und Seiten wandern
 * in das Ziel, die Quelle wird als gelöscht markiert.
 */
export async function mergeNodes(sourceId: string, targetId: string) {
  if (sourceId === targetId) return;
  await db.transaction('rw', db.nodes, db.pages, async () => {
    const nodes = await liveNodes();
    if (descendantIds(nodes, sourceId).has(targetId)) return;
    const t = now();
    const targetKids = childrenOf(nodes, targetId);
    let order = targetKids.length ? targetKids[targetKids.length - 1].order + 1 : 0;
    for (const kid of childrenOf(nodes, sourceId)) {
      await db.nodes.update(kid.id, { parentId: targetId, order: order++, updatedAt: t });
    }
    const pages = await db.pages.where('nodeIds').equals(sourceId).toArray();
    for (const p of pages) {
      const ids = Array.from(new Set(p.nodeIds.map((x) => (x === sourceId ? targetId : x))));
      await db.pages.update(p.id, { nodeIds: ids, updatedAt: t });
    }
    await db.nodes.update(sourceId, { deletedAt: t, updatedAt: t });
  });
}

/**
 * Löscht einen Knoten (als Markierung). Unterthemen rutschen eine Ebene
 * nach oben; Seiten bleiben erhalten und verlieren nur diese Zuordnung.
 */
export async function deleteNode(id: string) {
  await db.transaction('rw', db.nodes, db.pages, async () => {
    const nodes = await liveNodes();
    const me = nodes.find((n) => n.id === id);
    if (!me) return;
    const t = now();
    const sib = childrenOf(nodes, me.parentId);
    const idx = sib.findIndex((n) => n.id === id);
    const kids = childrenOf(nodes, id);
    const newOrder = [...sib.slice(0, idx), ...kids, ...sib.slice(idx + 1)];
    for (let k = 0; k < newOrder.length; k++) {
      await db.nodes.update(newOrder[k].id, { parentId: me.parentId, order: k, updatedAt: t });
    }
    const pages = await db.pages.where('nodeIds').equals(id).toArray();
    for (const p of pages) {
      await db.pages.update(p.id, { nodeIds: p.nodeIds.filter((x) => x !== id), updatedAt: t });
    }
    await db.nodes.update(id, { deletedAt: t, updatedAt: t });
  });
}

/**
 * Findet (oder legt an) einen Knoten anhand eines Pfads wie
 * "Training > Motorische Fähigkeiten > Kraft". Groß-/Kleinschreibung egal.
 */
export async function ensurePath(path: string): Promise<string | null> {
  const parts = path
    .split(/\s*[>›]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  let parentId: string | null = null;
  for (const part of parts) {
    const nodes = await liveNodes();
    const found: TreeNode | undefined = childrenOf(nodes, parentId).find(
      (n) => n.title.toLocaleLowerCase('de') === part.toLocaleLowerCase('de'),
    );
    parentId = found ? found.id : await createNode(part, parentId);
  }
  return parentId;
}

export { alive };
