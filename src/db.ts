import Dexie, { type Table } from 'dexie';
import type { Idea, ImageRecord, Meta, Page, TreeNode } from './types';

export class WissensDB extends Dexie {
  nodes!: Table<TreeNode, string>;
  pages!: Table<Page, string>;
  ideas!: Table<Idea, string>;
  images!: Table<ImageRecord, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('wissens-app');
    this.version(1).stores({
      nodes: 'id, parentId, updatedAt, deletedAt',
      pages: 'id, *nodeIds, *sports, *bodyRegions, *tags, status, updatedAt, deletedAt',
      ideas: 'id, done, updatedAt, deletedAt',
      images: 'id, updatedAt, deletedAt',
      meta: 'key',
    });
  }
}

export const db = new WissensDB();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function now(): number {
  return Date.now();
}

export function base() {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, deletedAt: null as number | null };
}

export const alive = <T extends { deletedAt: number | null }>(x: T | undefined): x is T =>
  !!x && x.deletedAt === null;
