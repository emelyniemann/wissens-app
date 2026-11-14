import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from './db';
import { buildIndex } from './search';
import type { Idea, Page, TreeNode } from './types';

export function useNodes(): TreeNode[] {
  return useLiveQuery(async () => (await db.nodes.toArray()).filter((n) => n.deletedAt === null), [], []) ?? [];
}

export function usePages(): Page[] {
  return useLiveQuery(async () => (await db.pages.toArray()).filter((p) => p.deletedAt === null), [], []) ?? [];
}

export function useIdeas(): Idea[] {
  return useLiveQuery(async () => (await db.ideas.toArray()).filter((i) => i.deletedAt === null), [], []) ?? [];
}

export function useMeta<T>(key: string): T | undefined {
  return useLiveQuery(async () => (await db.meta.get(key))?.value as T | undefined, [key]);
}

export function useSearchIndex() {
  const pages = usePages();
  const ideas = useIdeas();
  const nodes = useNodes();
  return useMemo(() => buildIndex(pages, ideas, nodes), [pages, ideas, nodes]);
}

/** Bild-URL aus der lokalen Datenbank (wird automatisch wieder freigegeben). */
export function useImageUrl(imageId: string | null | undefined): string | null {
  const rec = useLiveQuery(async () => (imageId ? db.images.get(imageId) : undefined), [imageId]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!rec || rec.deletedAt !== null) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(rec.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [rec]);
  return url;
}

/** Einstellung, die im Browser gemerkt wird. */
export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* egal */
    }
  };
  return [val, set];
}
