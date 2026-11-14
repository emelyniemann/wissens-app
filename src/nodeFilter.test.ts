import { describe, expect, it } from 'vitest';
import {
  applyFilter,
  availableMarks,
  DEFAULT_FILTER,
  directAreaLabel,
  normalizeFilter,
  sortPages,
  toggleMark,
  type NodeFilter,
} from './nodeFilter';
import type { Page, TreeNode } from './types';

const page = (id: string, title: string, o: Partial<Page> = {}): Page => ({
  id, title, createdAt: 0, updatedAt: 0, deletedAt: null, nodeIds: ['root'],
  sports: [], bodyRegions: [], tags: [], status: 'draft', blocks: [], ...o,
});
const node = (id: string, title: string, parentId: string | null): TreeNode => ({
  id, title, parentId, order: 0, createdAt: 0, updatedAt: 0, deletedAt: null,
});

const A = page('a', 'Kniebeuge', { tags: ['Kraft', 'Grundübung'], bodyRegions: ['Knie'], sports: ['Fußball'], status: 'reviewed', nodeIds: ['kraft'] });
const B = page('b', 'Ausfallschritt', { tags: ['Kraft'], bodyRegions: ['Hüfte'], nodeIds: ['root'] });
const C = page('c', 'Seilspringen', { tags: ['Ausdauer'], sports: ['Boxen'], nodeIds: ['ausdauer', 'kraft'] });
const all = [A, B, C];
const f = (o: Partial<NodeFilter> = {}): NodeFilter => ({ ...DEFAULT_FILTER, ...o });

describe('Bereichs-Filter', () => {
  it('ohne Filter: alle Seiten', () => {
    expect(applyFilter(all, f(), null)).toHaveLength(3);
  });
  it('mehrere Markierungen = Seite muss alle haben (UND)', () => {
    let fl = toggleMark(f(), 'tag', 'Kraft');
    expect(applyFilter(all, fl, null).map((p) => p.id)).toEqual(['a', 'b']);
    fl = toggleMark(fl, 'region', 'knie'); // Groß-/Kleinschreibung egal
    expect(applyFilter(all, fl, null).map((p) => p.id)).toEqual(['a']);
    fl = toggleMark(fl, 'tag', 'Kraft'); // abwählen
    expect(fl.marks).toHaveLength(1);
  });
  it('Prüfstatus', () => {
    expect(applyFilter(all, f({ status: 'draft' }), null).map((p) => p.id)).toEqual(['b', 'c']);
    expect(applyFilter(all, f({ status: 'reviewed' }), null).map((p) => p.id)).toEqual(['a']);
  });
  it('Suchtreffer begrenzen die Liste', () => {
    expect(applyFilter(all, f(), new Set(['c', 'zzz'])).map((p) => p.id)).toEqual(['c']);
  });
  it('angebotene Markierungen stammen nur aus angezeigten Seiten, ausgewählte bleiben sichtbar', () => {
    const fl = toggleMark(f(), 'sport', 'Rudern');
    const m = availableMarks([A, B], fl);
    expect(m.tag.map((x) => x.value)).toEqual(['Grundübung', 'Kraft']);
    expect(m.tag.find((x) => x.value === 'Kraft')!.count).toBe(2);
    expect(m.sport.map((x) => x.value)).toEqual(['Fußball', 'Rudern']);
    expect(m.tag.some((x) => x.value === 'Ausdauer')).toBe(false);
  });
  it('Sortierung nach Titel, Status und Unterthema (auf- und absteigend)', () => {
    const nodes = [node('root', 'Training', null), node('kraft', 'Kraft', 'root'), node('ausdauer', 'Ausdauer', 'root')];
    const area = new Set(['root', 'kraft', 'ausdauer']);
    const areaOf = (p: Page) => directAreaLabel(p, area, nodes, 'root');
    expect(areaOf(C)).toBe('Ausdauer, Kraft');
    expect(areaOf(B)).toBe('');
    expect(sortPages(all, f(), areaOf).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(sortPages(all, f({ sort: { key: 'title', dir: 'desc' } }), areaOf).map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(sortPages(all, f({ sort: { key: 'status', dir: 'asc' } }), areaOf).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    // Leere Unterthemen ("direkt hier") stehen immer am Ende
    expect(sortPages(all, f({ sort: { key: 'area', dir: 'asc' } }), areaOf).map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(sortPages(all, f({ sort: { key: 'area', dir: 'desc' } }), areaOf).map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });
  it('kaputte oder alte gespeicherte Einstellungen werden repariert', () => {
    const n = normalizeFilter({ status: 'quatsch' as any, marks: 'x' as any }, false);
    expect(n.status).toBe('all');
    expect(n.marks).toEqual([]);
    expect(n.withSub).toBe(false);
    expect(normalizeFilter(null).view).toBe('list');
  });
  it('verändert keine Seiten', () => {
    const before = JSON.stringify(all);
    sortPages(applyFilter(all, toggleMark(f({ status: 'draft' }), 'tag', 'Kraft'), null), f(), () => '');
    expect(JSON.stringify(all)).toBe(before);
  });
});
