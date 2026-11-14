// Datenmodell der Wissens-App.
// Jeder Datensatz hat: eindeutige ID, Erstellungs- und Änderungszeitpunkt,
// und "deletedAt" (Löschen = Markierung, nicht endgültig). So ist später
// ein Abgleich zwischen Geräten (z. B. Supabase) leicht möglich.

export interface Base {
  id: string;
  createdAt: number; // Millisekunden seit 1970
  updatedAt: number;
  deletedAt: number | null;
}

/** Ein Knoten im Themenbaum. Reiter = Knoten ohne Eltern (parentId = null). */
export interface TreeNode extends Base {
  title: string;
  parentId: string | null;
  order: number;
  /** Sonderfunktion: 'notes' = Ideenliste, 'sports' = Sportarten-Übersicht. */
  special?: 'notes' | 'sports';
}

export type ReviewStatus = 'draft' | 'reviewed';

export interface SourceRef {
  id: string;
  text: string;
  url?: string;
  stand?: string; // Stand / Abrufdatum, z. B. "2024-05" oder "2024-05-12"
}

export interface PageRefItem {
  id: string;
  pageId: string;
  comment?: string;
}

export type Block =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'bullets'; items: string[] }
  | { id: string; type: 'table'; rows: string[][]; header: boolean }
  | { id: string; type: 'image'; imageId: string | null; caption?: string; credit?: string }
  | { id: string; type: 'training'; text: string }
  | { id: string; type: 'exercises'; items: PageRefItem[] }
  | { id: string; type: 'tests'; items: PageRefItem[] }
  | { id: string; type: 'sources'; items: SourceRef[] }
  | { id: string; type: 'notes'; text: string };

export type BlockType = Block['type'];

export interface Page extends Base {
  title: string;
  nodeIds: string[]; // Zuordnung(en) im Themenbaum – mehrere möglich
  sports: string[];
  bodyRegions: string[];
  tags: string[];
  status: ReviewStatus;
  blocks: Block[];
}

/** Eintrag in der Ideen-/Themenliste (Reiter „Notizen“). */
export interface Idea extends Base {
  text: string;
  done: boolean;
  pageId: string | null;
}

/** Lokal gespeichertes Bild. */
export interface ImageRecord extends Base {
  name: string;
  mime: string;
  blob: Blob;
  credit?: string; // Quellenangabe / Lizenz
}

export interface Meta {
  key: string;
  value: unknown;
}
