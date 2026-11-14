import { base, db, newId, now } from './db';
import type { Block, BlockType, Page } from './types';

export const BLOCK_LABELS: Record<BlockType, string> = {
  text: 'Text',
  bullets: 'Stichpunkte',
  table: 'Tabelle',
  image: 'Abbildung',
  training: 'Bedeutung fürs Training',
  exercises: 'Übungen',
  tests: 'Tests',
  sources: 'Quellen',
  notes: 'Eigene Notizen',
};

export const BLOCK_ORDER: BlockType[] = [
  'text',
  'bullets',
  'training',
  'table',
  'image',
  'exercises',
  'tests',
  'sources',
  'notes',
];

export function newBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'text':
      return { id, type, text: '' };
    case 'bullets':
      return { id, type, items: [''] };
    case 'table':
      return { id, type, header: true, rows: [['', ''], ['', '']] };
    case 'image':
      return { id, type, imageId: null, caption: '', credit: '' };
    case 'training':
      return { id, type, text: '' };
    case 'exercises':
      return { id, type, items: [] };
    case 'tests':
      return { id, type, items: [] };
    case 'sources':
      return { id, type, items: [] };
    case 'notes':
      return { id, type, text: '' };
  }
}

export async function createPage(init: Partial<Page> = {}): Promise<string> {
  const page: Page = {
    ...base(),
    title: 'Neue Seite',
    nodeIds: [],
    sports: [],
    bodyRegions: [],
    tags: [],
    status: 'draft',
    blocks: [newBlock('text'), newBlock('training')],
    ...init,
  };
  await db.pages.add(page);
  return page.id;
}

export async function savePage(page: Page) {
  await db.pages.put({ ...page, updatedAt: now() });
}

export async function softDeletePage(id: string) {
  const t = now();
  await db.pages.update(id, { deletedAt: t, updatedAt: t });
}

export async function restorePage(id: string) {
  await db.pages.update(id, { deletedAt: null, updatedAt: now() });
}

/** Gesamter Text einer Seite – für die Volltextsuche. */
export function pageText(p: Page): string {
  const parts: string[] = [];
  for (const b of p.blocks) {
    switch (b.type) {
      case 'text':
      case 'training':
      case 'notes':
        parts.push(b.text);
        break;
      case 'bullets':
        parts.push(b.items.join('\n'));
        break;
      case 'table':
        parts.push(b.rows.map((r) => r.join(' ')).join('\n'));
        break;
      case 'image':
        parts.push(b.caption ?? '', b.credit ?? '');
        break;
      case 'exercises':
      case 'tests':
        parts.push(b.items.map((i) => i.comment ?? '').join(' '));
        break;
      case 'sources':
        parts.push(b.items.map((s) => `${s.text} ${s.stand ?? ''}`).join('\n'));
        break;
    }
  }
  return parts.join('\n').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
}

/** Alle Seiten-IDs bzw. -Titel, auf die eine Seite verweist. */
export function outgoingLinks(p: Page): { ids: string[]; titles: string[] } {
  const ids = new Set<string>();
  const titles = new Set<string>();
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  for (const b of p.blocks) {
    let texts: string[] = [];
    if (b.type === 'text' || b.type === 'training' || b.type === 'notes') texts = [b.text];
    if (b.type === 'bullets') texts = b.items;
    if (b.type === 'table') texts = b.rows.flat();
    if (b.type === 'exercises' || b.type === 'tests') b.items.forEach((i) => ids.add(i.pageId));
    for (const t of texts) {
      for (const m of t.matchAll(re)) {
        if (m[2] !== undefined) ids.add(m[1]);
        else titles.add(m[1].trim().toLocaleLowerCase('de'));
      }
    }
  }
  return { ids: [...ids], titles: [...titles] };
}
