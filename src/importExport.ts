// Sicherung (Export) und Einspielen (Import).
// Das Format ist in CLAUDE.md beschrieben.
import { base, db, newId, now } from './db';
import { newBlock } from './pages';
import { ensurePath } from './tree';
import type { Block, Idea, ImageRecord, Page, TreeNode } from './types';

export const FORMAT = 'wissens-app';
export const FORMAT_VERSION = 1;

interface ExportImage extends Omit<ImageRecord, 'blob'> {
  dataUrl: string;
}

export interface ExportFile {
  format: string;
  version: number;
  exportedAt?: string;
  nodes?: TreeNode[];
  pages?: any[];
  ideas?: Idea[];
  images?: ExportImage[];
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

function dataUrlToBlob(url: string): Blob {
  const [head, data] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Exportiert ALLES (auch als gelöscht markierte Einträge – für späteren Abgleich). */
export async function exportAll(): Promise<ExportFile> {
  const images: ExportImage[] = [];
  for (const img of await db.images.toArray()) {
    const { blob, ...rest } = img;
    images.push({ ...rest, dataUrl: await blobToDataUrl(blob) });
  }
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    nodes: await db.nodes.toArray(),
    pages: await db.pages.toArray(),
    ideas: await db.ideas.toArray(),
    images,
  };
}

export interface ImportResult {
  nodes: number;
  pagesNew: number;
  pagesUpdated: number;
  ideas: number;
  images: number;
  warnings: string[];
}

const arr = (x: unknown): string[] =>
  Array.isArray(x) ? x.map((v) => String(v).trim()).filter(Boolean) : typeof x === 'string' && x.trim() ? [x.trim()] : [];

/** Wandelt einen (evtl. vereinfachten) Baustein in einen gültigen Baustein um. */
function normalizeBlock(raw: any, warnings: string[]): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type ?? '');
  const id = typeof raw.id === 'string' ? raw.id : newId();
  const refItems = (items: any) =>
    (Array.isArray(items) ? items : []).map((it: any) =>
      typeof it === 'string'
        ? { id: newId(), pageId: '', title: it }
        : { id: it.id ?? newId(), pageId: it.pageId ?? '', title: it.title, comment: it.comment },
    );
  switch (type) {
    case 'text':
    case 'training':
    case 'notes':
      return { id, type, text: String(raw.text ?? '') } as Block;
    case 'bullets':
      return { id, type, items: arr(raw.items) };
    case 'table': {
      const rows = Array.isArray(raw.rows) ? raw.rows.map((r: any) => (Array.isArray(r) ? r.map(String) : [String(r)])) : [];
      return { id, type, header: raw.header !== false, rows: rows.length ? rows : (newBlock('table') as any).rows };
    }
    case 'image':
      return { id, type, imageId: raw.imageId ?? null, caption: raw.caption ?? '', credit: raw.credit ?? '' };
    case 'exercises':
    case 'tests':
      return { id, type, items: refItems(raw.items) } as any;
    case 'sources':
      return {
        id,
        type,
        items: (Array.isArray(raw.items) ? raw.items : []).map((s: any) =>
          typeof s === 'string'
            ? { id: newId(), text: s }
            : { id: s.id ?? newId(), text: String(s.text ?? ''), url: s.url, stand: s.stand },
        ),
      };
    default:
      warnings.push(`Unbekannter Baustein-Typ „${type}“ wurde übersprungen.`);
      return null;
  }
}

/**
 * Spielt eine Datei ein. Vorhandene Einträge (gleiche ID) werden nur
 * überschrieben, wenn der importierte Stand neuer ist. Nichts wird gelöscht.
 */
export async function importData(input: unknown): Promise<ImportResult> {
  const data = input as ExportFile;
  if (!data || typeof data !== 'object' || data.format !== FORMAT) {
    throw new Error('Das ist keine Datei der Wissens-App (Feld "format" muss "wissens-app" sein).');
  }
  const res: ImportResult = { nodes: 0, pagesNew: 0, pagesUpdated: 0, ideas: 0, images: 0, warnings: [] };

  // 1) Baumknoten
  for (const n of data.nodes ?? []) {
    if (!n?.id) continue;
    const cur = await db.nodes.get(n.id);
    if (!cur || (n.updatedAt ?? 0) > cur.updatedAt) {
      await db.nodes.put({ ...n, deletedAt: n.deletedAt ?? null, updatedAt: n.updatedAt ?? now(), createdAt: n.createdAt ?? now() });
      res.nodes++;
    }
  }

  // 2) Bilder
  for (const img of data.images ?? []) {
    if (!img?.id || !img.dataUrl) continue;
    const cur = await db.images.get(img.id);
    if (!cur || (img.updatedAt ?? 0) > cur.updatedAt) {
      const { dataUrl, ...rest } = img;
      await db.images.put({ ...rest, blob: dataUrlToBlob(dataUrl), deletedAt: rest.deletedAt ?? null } as ImageRecord);
      res.images++;
    }
  }

  // 3) Seiten (auch vereinfachte Seiten, z. B. von Claude erstellt)
  const pending: { page: Page; refs: Block[] }[] = [];
  for (const raw of data.pages ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const nodeIds: string[] = arr(raw.nodeIds);
    for (const path of arr(raw.areas ?? raw.bereiche)) {
      const id = await ensurePath(path);
      if (id && !nodeIds.includes(id)) nodeIds.push(id);
    }
    const blocks = (Array.isArray(raw.blocks) ? raw.blocks : [])
      .map((b: any) => normalizeBlock(b, res.warnings))
      .filter(Boolean) as Block[];
    const t = now();
    const page: Page = {
      ...base(),
      id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
      createdAt: raw.createdAt ?? t,
      updatedAt: raw.updatedAt ?? t,
      deletedAt: raw.deletedAt ?? null,
      title: String(raw.title ?? 'Ohne Titel'),
      nodeIds,
      sports: arr(raw.sports),
      bodyRegions: arr(raw.bodyRegions),
      tags: arr(raw.tags),
      status: raw.status === 'reviewed' ? 'reviewed' : 'draft',
      blocks,
    };
    pending.push({ page, refs: blocks.filter((b) => b.type === 'exercises' || b.type === 'tests') });
  }

  // Verweise per Titel (Übungen/Tests) auf Seiten-IDs auflösen
  const all = [...(await db.pages.toArray()).filter((p) => p.deletedAt === null), ...pending.map((x) => x.page)];
  const byTitle = new Map(all.map((p) => [p.title.toLocaleLowerCase('de'), p.id]));
  for (const { page, refs } of pending) {
    for (const b of refs as any[]) {
      b.items = b.items
        .map((it: any) => {
          if (!it.pageId && it.title) {
            const id = byTitle.get(String(it.title).toLocaleLowerCase('de'));
            if (!id) res.warnings.push(`„${page.title}“: Verweis auf „${it.title}“ nicht gefunden.`);
            return id ? { id: it.id, pageId: id, comment: it.comment } : null;
          }
          return it.pageId ? { id: it.id, pageId: it.pageId, comment: it.comment } : null;
        })
        .filter(Boolean);
    }
    const cur = await db.pages.get(page.id);
    if (!cur) {
      await db.pages.put(page);
      res.pagesNew++;
    } else if (page.updatedAt > cur.updatedAt) {
      await db.pages.put(page);
      res.pagesUpdated++;
    }
  }

  // 4) Ideen
  for (const raw of data.ideas ?? []) {
    if (!raw) continue;
    const idea: Idea = {
      ...base(),
      ...(raw as any),
      text: String((raw as any).text ?? ''),
      done: !!(raw as any).done,
      pageId: (raw as any).pageId ?? null,
      deletedAt: (raw as any).deletedAt ?? null,
    };
    const cur = await db.ideas.get(idea.id);
    if (!cur || idea.updatedAt > cur.updatedAt) {
      await db.ideas.put(idea);
      res.ideas++;
    }
  }
  return res;
}

export async function downloadBackup() {
  const data = await exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `wissens-app-sicherung-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await db.meta.put({ key: 'lastBackup', value: Date.now() });
}
