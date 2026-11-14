import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { exportAll, importData } from './importExport';
import { outgoingLinks } from './pages';
import { buildIndex } from './search';
import { ensureSeed, ROOT_TABS } from './seed';
import { childrenOf, createNode, deleteNode, liveNodes, mergeNodes, moveNode, pathLabel, renameNode } from './tree';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeed();
});

const byTitle = async (t: string) => (await liveNodes()).find((n) => n.title === t)!;

describe('Startinhalte', () => {
  it('legt Reiter in der richtigen Reihenfolge an', async () => {
    const roots = childrenOf(await liveNodes(), null).map((n) => n.title);
    expect(roots).toEqual(ROOT_TABS);
  });
  it('legt Training-Unterthemen an', async () => {
    const nodes = await liveNodes();
    const t = await byTitle('Training');
    expect(childrenOf(nodes, t.id).map((n) => n.title)).toEqual([
      'Grundlagen',
      'Motorische Fähigkeiten',
      'Planung & Periodisierung',
      'Belastungssteuerung',
      'Zielgruppen',
      'Prävention & Athletik',
      'Sportartspezifisch',
      'Vorlagen',
    ]);
    const mf = await byTitle('Motorische Fähigkeiten');
    expect(childrenOf(nodes, mf.id)).toHaveLength(5);
  });
  it('legt nicht doppelt an', async () => {
    expect(await ensureSeed()).toBe(false);
    expect(await db.pages.count()).toBe(3);
  });
});

describe('Themenbaum', () => {
  it('Verschieben und Umbenennen behält Seitenzuordnungen', async () => {
    const kraft = await byTitle('Kraft');
    const grundlagen = await byTitle('Grundlagen');
    await renameNode(kraft.id, 'Krafttraining');
    await moveNode(kraft.id, grundlagen.id, 0);
    const nodes = await liveNodes();
    expect(pathLabel(nodes, kraft.id)).toBe('Training › Grundlagen › Krafttraining');
    const pages = await db.pages.where('nodeIds').equals(kraft.id).toArray();
    expect(pages.map((p) => p.title)).toContain('Hypertrophie – Grundlagen');
  });
  it('verhindert Verschieben in eigenes Unterthema', async () => {
    const training = await byTitle('Training');
    const kraft = await byTitle('Kraft');
    await moveNode(training.id, kraft.id, 0);
    expect((await db.nodes.get(training.id))!.parentId).toBeNull();
  });
  it('Zusammenlegen überträgt Seiten und Unterthemen', async () => {
    const mf = await byTitle('Motorische Fähigkeiten');
    const g = await byTitle('Grundlagen');
    await mergeNodes(mf.id, g.id);
    const nodes = await liveNodes();
    expect(nodes.find((n) => n.id === mf.id)).toBeUndefined();
    expect(childrenOf(nodes, g.id).map((n) => n.title)).toContain('Kraft');
    expect((await db.nodes.get(mf.id))!.deletedAt).not.toBeNull(); // nur markiert
  });
  it('Löschen behält Seiten', async () => {
    const kraft = await byTitle('Kraft');
    await deleteNode(kraft.id);
    const p = (await db.pages.toArray()).find((x) => x.title.startsWith('Hypertrophie'))!;
    expect(p.deletedAt).toBeNull();
    expect(p.nodeIds).not.toContain(kraft.id);
  });
  it('Neues Unterthema wird hinten angehängt', async () => {
    const t = await byTitle('Training');
    const id = await createNode('Regeneration', t.id);
    const kids = childrenOf(await liveNodes(), t.id);
    expect(kids[kids.length - 1].id).toBe(id);
  });
});

describe('Links und Suche', () => {
  it('findet interne Links', async () => {
    const p = (await db.pages.toArray()).find((x) => x.title.startsWith('Hypertrophie'))!;
    const squat = (await db.pages.toArray()).find((x) => x.title.startsWith('Kniebeuge'))!;
    expect(outgoingLinks(p).ids).toContain(squat.id);
  });
  it('Volltextsuche findet Wörter im Inhalt (auch ohne Umlaute)', async () => {
    const idx = buildIndex(await db.pages.toArray(), await db.ideas.toArray(), await liveNodes());
    expect(idx.search('Wochenvolumen').length).toBeGreaterThan(0);
    expect(idx.search('ermudung').length).toBeGreaterThan(0);
    expect(idx.search('Kreuzband').some((r) => String(r.id).startsWith('i:'))).toBe(true);
  });
});

describe('Import / Export', () => {
  it('spielt eine von Claude erstellte Seite ein (Pfade, Verweise per Titel)', async () => {
    const res = await importData({
      format: 'wissens-app',
      version: 1,
      pages: [
        {
          title: 'Plyometrie im Fußball',
          areas: ['Training > Motorische Fähigkeiten > Schnelligkeit & Power', 'Sportarten > Fußball'],
          sports: ['Fußball'],
          tags: ['Sprungkraft'],
          blocks: [
            { type: 'text', text: 'Siehe [[Kniebeuge (Back Squat)]].' },
            { type: 'bullets', items: ['A', 'B'] },
            { type: 'training', text: '2× pro Woche' },
            { type: 'exercises', items: [{ title: 'Kniebeuge (Back Squat)', comment: 'Basis' }] },
            { type: 'sources', items: [{ text: 'Quelle X', stand: '2025-01' }] },
            { type: 'gibtsnicht' },
          ],
        },
      ],
    });
    expect(res.pagesNew).toBe(1);
    expect(res.warnings.length).toBe(1);
    const p = (await db.pages.toArray()).find((x) => x.title === 'Plyometrie im Fußball')!;
    const nodes = await liveNodes();
    expect(p.nodeIds.map((id) => pathLabel(nodes, id))).toEqual([
      'Training › Motorische Fähigkeiten › Schnelligkeit & Power',
      'Sportarten › Fußball',
    ]);
    expect(p.status).toBe('draft');
    const ex = p.blocks.find((b) => b.type === 'exercises') as any;
    expect(ex.items[0].pageId).toBeTruthy();
  });
  it('Export und erneuter Import verdoppelt nichts', async () => {
    const data = await exportAll();
    const before = await db.pages.count();
    const res = await importData(JSON.parse(JSON.stringify(data)));
    expect(res.pagesNew).toBe(0);
    expect(await db.pages.count()).toBe(before);
  });
  it('Sicherung lässt sich in leere Datenbank einspielen', async () => {
    const data = JSON.parse(JSON.stringify(await exportAll()));
    await db.delete();
    await db.open();
    const res = await importData(data);
    expect(res.pagesNew).toBe(3);
    expect(childrenOf(await liveNodes(), null)).toHaveLength(10);
  });
  it('lehnt fremde Dateien ab', async () => {
    await expect(importData({ foo: 1 })).rejects.toThrow();
  });
});

describe('Dokumentation', () => {
  it('das Import-Beispiel in CLAUDE.md lässt sich einspielen', async () => {
    const { readFileSync } = await import('node:fs');
    const md = readFileSync(new URL('../CLAUDE.md', import.meta.url), 'utf8');
    const json = /```json\n([\s\S]*?)```/.exec(md)![1];
    const res = await importData(JSON.parse(json));
    expect(res.pagesNew).toBe(1);
    expect(res.warnings).toEqual([]);
  });
});
