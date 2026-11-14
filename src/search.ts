import MiniSearch from 'minisearch';
import { pageText } from './pages';
import type { Idea, Page, TreeNode } from './types';

export interface SearchDoc {
  id: string;
  kind: 'page' | 'idea' | 'node';
  title: string;
  body: string;
  marks: string;
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss');

export function buildIndex(pages: Page[], ideas: Idea[], nodes: TreeNode[]) {
  const ms = new MiniSearch<SearchDoc>({
    fields: ['title', 'body', 'marks'],
    storeFields: ['kind', 'title', 'body'],
    processTerm: (t) => norm(t),
    searchOptions: {
      boost: { title: 3, marks: 2 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
  const docs: SearchDoc[] = [];
  for (const p of pages)
    docs.push({
      id: 'p:' + p.id,
      kind: 'page',
      title: p.title,
      body: pageText(p),
      marks: [...p.sports, ...p.bodyRegions, ...p.tags].join(' '),
    });
  for (const i of ideas) docs.push({ id: 'i:' + i.id, kind: 'idea', title: i.text, body: '', marks: '' });
  for (const n of nodes) docs.push({ id: 'n:' + n.id, kind: 'node', title: n.title, body: '', marks: '' });
  ms.addAll(docs);
  return ms;
}

/** Kurzer Textausschnitt rund um den ersten Treffer. */
export function snippet(body: string, query: string, len = 160): string {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const nb = norm(body);
  let pos = -1;
  for (const w of words) {
    const p = nb.indexOf(w);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  const start = Math.max(0, pos - 50);
  const s = body.slice(start, start + len).replace(/\s+/g, ' ');
  return (start > 0 ? '… ' : '') + s + (start + len < body.length ? ' …' : '');
}
