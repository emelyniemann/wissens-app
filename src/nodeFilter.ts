// Filter, Sortierung und Ansicht für die Bereichsansicht (NodeScreen).
// Wird pro Bereich im Browser gemerkt (localStorage) – die Seiten selbst
// werden dabei nie verändert.
import type { Page, TreeNode } from './types';

export type MarkKind = 'sport' | 'region' | 'tag';
export type StatusFilter = 'all' | 'draft' | 'reviewed';
export type SortKey = 'title' | 'area' | 'marks' | 'status';

export interface NodeFilter {
  withSub: boolean;
  marks: { kind: MarkKind; value: string }[];
  status: StatusFilter;
  q: string;
  view: 'list' | 'table';
  sort: { key: SortKey; dir: 'asc' | 'desc' };
}

export const DEFAULT_FILTER: NodeFilter = {
  withSub: true,
  marks: [],
  status: 'all',
  q: '',
  view: 'list',
  sort: { key: 'title', dir: 'asc' },
};

/** Ergänzt fehlende Felder (z. B. aus älteren gespeicherten Einstellungen). */
export function normalizeFilter(raw: Partial<NodeFilter> | null | undefined, fallbackWithSub = true): NodeFilter {
  const f = { ...DEFAULT_FILTER, withSub: fallbackWithSub, ...(raw ?? {}) };
  return {
    ...f,
    marks: Array.isArray(f.marks) ? f.marks.filter((m) => m && m.kind && typeof m.value === 'string') : [],
    status: ['all', 'draft', 'reviewed'].includes(f.status) ? f.status : 'all',
    view: f.view === 'table' ? 'table' : 'list',
    sort: f.sort && f.sort.key ? f.sort : DEFAULT_FILTER.sort,
    q: typeof f.q === 'string' ? f.q : '',
  };
}

export const FIELD: Record<MarkKind, 'sports' | 'bodyRegions' | 'tags'> = {
  sport: 'sports',
  region: 'bodyRegions',
  tag: 'tags',
};

const lc = (s: string) => s.toLocaleLowerCase('de');

export function hasMark(p: Page, kind: MarkKind, value: string): boolean {
  return p[FIELD[kind]].some((x) => lc(x) === lc(value));
}

export function isMarkSelected(f: NodeFilter, kind: MarkKind, value: string) {
  return f.marks.some((m) => m.kind === kind && lc(m.value) === lc(value));
}

export function toggleMark(f: NodeFilter, kind: MarkKind, value: string): NodeFilter {
  return isMarkSelected(f, kind, value)
    ? { ...f, marks: f.marks.filter((m) => !(m.kind === kind && lc(m.value) === lc(value))) }
    : { ...f, marks: [...f.marks, { kind, value }] };
}

/**
 * Wendet Filter an. "matchIds" = Treffer der Suche (null = keine Suche aktiv).
 * Mehrere ausgewählte Markierungen: die Seite muss ALLE haben.
 */
export function applyFilter(pages: Page[], f: NodeFilter, matchIds: Set<string> | null): Page[] {
  return pages.filter(
    (p) =>
      (f.status === 'all' || p.status === f.status) &&
      f.marks.every((m) => hasMark(p, m.kind, m.value)) &&
      (!matchIds || matchIds.has(p.id)),
  );
}

/**
 * Markierungen, die in den angezeigten Seiten vorkommen (mit Anzahl).
 * Bereits ausgewählte bleiben immer sichtbar, damit man sie abwählen kann.
 */
export function availableMarks(shown: Page[], f: NodeFilter): Record<MarkKind, { value: string; count: number }[]> {
  const out = {} as Record<MarkKind, { value: string; count: number }[]>;
  for (const kind of ['sport', 'region', 'tag'] as MarkKind[]) {
    const m = new Map<string, { value: string; count: number }>();
    for (const p of shown)
      for (const v of p[FIELD[kind]]) {
        const e = m.get(lc(v));
        if (e) e.count++;
        else m.set(lc(v), { value: v, count: 1 });
      }
    for (const s of f.marks) if (s.kind === kind && !m.has(lc(s.value))) m.set(lc(s.value), { value: s.value, count: 0 });
    out[kind] = [...m.values()].sort((a, b) => a.value.localeCompare(b.value, 'de'));
  }
  return out;
}

/** Name des direkten Bereichs einer Seite innerhalb des angezeigten Bereichs. */
export function directAreaLabel(p: Page, areaIds: Set<string>, nodes: TreeNode[], currentId: string): string {
  return p.nodeIds
    .filter((id) => areaIds.has(id) && id !== currentId)
    .map((id) => nodes.find((n) => n.id === id)?.title ?? '')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'de'))
    .join(', ');
}

export function marksLabel(p: Page): string {
  return [...p.sports, ...p.bodyRegions, ...p.tags].join(', ');
}

export function sortPages(pages: Page[], f: NodeFilter, areaOf: (p: Page) => string): Page[] {
  const key = (p: Page): string => {
    switch (f.sort.key) {
      case 'title':
        return p.title;
      case 'area':
        return areaOf(p);
      case 'marks':
        return marksLabel(p);
      case 'status':
        return p.status === 'draft' ? '0' : '1';
    }
  };
  const dir = f.sort.dir === 'asc' ? 1 : -1;
  return pages.slice().sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    // Leere Werte immer ans Ende
    if (!ka && kb) return 1;
    if (ka && !kb) return -1;
    return (ka.localeCompare(kb, 'de') || a.title.localeCompare(b.title, 'de')) * dir;
  });
}

export function filterActive(f: NodeFilter): boolean {
  return f.marks.length > 0 || f.status !== 'all' || f.q.trim() !== '';
}
