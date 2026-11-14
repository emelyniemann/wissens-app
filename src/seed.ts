// Startinhalte: Reiter, Training-Unterthemen und kleine Beispielseiten.
// Wird nur ein einziges Mal beim allerersten Start angelegt.
import { base, db, newId } from './db';
import type { Idea, Page, TreeNode } from './types';

export const ROOT_TABS = [
  'Training',
  'Anatomie',
  'Physiologie & Biomechanik',
  'Verletzungen & Reha',
  'Übungen',
  'Diagnostik & Tests',
  'Ernährung',
  'Sportarten',
  'Quellen',
  'Notizen',
];

type Spec = [string, Spec[]?];
const TRAINING_CHILDREN: Spec[] = [
  ['Grundlagen'],
  [
    'Motorische Fähigkeiten',
    [['Kraft'], ['Ausdauer'], ['Schnelligkeit & Power'], ['Beweglichkeit'], ['Koordination & Stabilität']],
  ],
  ['Planung & Periodisierung', [['Krafttrainingspläne erstellen']]],
  ['Belastungssteuerung'],
  ['Zielgruppen'],
  ['Prävention & Athletik'],
  ['Sportartspezifisch'],
  ['Vorlagen'],
];

export async function ensureSeed(): Promise<boolean> {
  const done = await db.meta.get('seeded');
  if (done) return false;
  await db.transaction('rw', [db.nodes, db.pages, db.ideas, db.meta], async () => {
    const nodes: TreeNode[] = [];
    const byTitle: Record<string, string> = {};
    const add = (title: string, parentId: string | null, order: number) => {
      const n: TreeNode = { ...base(), title, parentId, order };
      if (parentId === null && title === 'Notizen') n.special = 'notes';
      if (parentId === null && title === 'Sportarten') n.special = 'sports';
      nodes.push(n);
      byTitle[title] = n.id;
      return n.id;
    };
    ROOT_TABS.forEach((t, i) => add(t, null, i));
    const walk = (specs: Spec[], parent: string) =>
      specs.forEach(([title, kids], i) => {
        const id = add(title, parent, i);
        if (kids) walk(kids, id);
      });
    walk(TRAINING_CHILDREN, byTitle['Training']);
    await db.nodes.bulkAdd(nodes);

    const squatId = newId();
    const rmId = newId();
    const hyperId = newId();
    const bid = () => newId();

    const squat: Page = {
      ...base(),
      id: squatId,
      title: 'Kniebeuge (Back Squat)',
      nodeIds: [byTitle['Übungen']],
      sports: ['Fußball', 'Leichtathletik'],
      bodyRegions: ['Hüfte', 'Knie', 'Oberschenkel'],
      tags: ['Grundübung', 'Langhantel'],
      status: 'draft',
      blocks: [
        {
          id: bid(),
          type: 'bullets',
          items: [
            'Hauptmuskeln: Quadrizeps, Gesäßmuskulatur, Adduktoren',
            'Stand etwa schulterbreit, Knie folgen der Fußspitze',
            'Rumpf aktiv stabilisieren, neutrale Wirbelsäule',
          ],
        },
        {
          id: bid(),
          type: 'training',
          text: 'Gute Basisübung für Kraft und Muskelaufbau der unteren Extremität. Bewegungstiefe an die Beweglichkeit anpassen. Gehört zu [[' + hyperId + '|Hypertrophie – Grundlagen]].',
        },
      ],
    };

    const rm: Page = {
      ...base(),
      id: rmId,
      title: '1RM-Test (Maximalkrafttest)',
      nodeIds: [byTitle['Diagnostik & Tests']],
      sports: [],
      bodyRegions: [],
      tags: ['Krafttest'],
      status: 'draft',
      blocks: [
        {
          id: bid(),
          type: 'text',
          text: 'Ermittelt das höchste Gewicht, das bei einer Übung **einmal** sauber bewegt werden kann (One-Repetition-Maximum).',
        },
        {
          id: bid(),
          type: 'training',
          text: 'Grundlage, um Trainingsgewichte in Prozent des Maximums festzulegen. Für Einsteiger eher indirekt schätzen (z. B. über Wiederholungen bis kurz vor Ermüdung).',
        },
      ],
    };

    const hyper: Page = {
      ...base(),
      id: hyperId,
      title: 'Hypertrophie – Grundlagen',
      nodeIds: [byTitle['Kraft'], byTitle['Physiologie & Biomechanik']],
      sports: ['Fußball'],
      bodyRegions: ['Ganzkörper'],
      tags: ['Muskelaufbau', 'Beispielseite'],
      status: 'draft',
      blocks: [
        {
          id: bid(),
          type: 'text',
          text: 'Dies ist eine **Beispielseite**. Sie zeigt, wie eine Seite aufgebaut ist: oben der feste Rahmen (Titel, Zuordnung, Markierungen, Prüfstatus), darunter frei kombinierbare Bausteine.\n\nHypertrophie bedeutet die Zunahme des Muskelquerschnitts. Entscheidend sind ein ausreichender Trainingsreiz, genügend Wochenvolumen und Erholung. Verwandte Übung: [[' + squatId + '|Kniebeuge (Back Squat)]].',
        },
        {
          id: bid(),
          type: 'bullets',
          items: [
            'Reiz: Sätze nahe an der Ermüdungsgrenze',
            'Volumen: mehr Wochensätze führen bis zu einem gewissen Punkt zu mehr Zuwachs',
            'Lastbereich: sowohl leichte als auch schwere Lasten wirken, wenn nahe an Ermüdung trainiert wird',
          ],
        },
        {
          id: bid(),
          type: 'table',
          header: true,
          rows: [
            ['Kenngröße', 'Orientierung (Beispiel)'],
            ['Sätze pro Muskel / Woche', 'ca. 10–20'],
            ['Wiederholungen', 'ca. 6–30'],
            ['Pause zwischen Sätzen', '1–3 Minuten'],
          ],
        },
        {
          id: bid(),
          type: 'training',
          text: 'Wochensätze pro Muskelgruppe schrittweise steigern, Sätze nahe an der Ermüdung beenden und Fortschritt dokumentieren.',
        },
        {
          id: bid(),
          type: 'exercises',
          items: [{ id: bid(), pageId: squatId, comment: 'Hauptübung untere Extremität' }],
        },
        {
          id: bid(),
          type: 'tests',
          items: [{ id: bid(), pageId: rmId, comment: 'zur Festlegung der Trainingslast' }],
        },
        {
          id: bid(),
          type: 'sources',
          items: [
            {
              id: bid(),
              text: 'Schoenfeld BJ, Ogborn D, Krieger JW (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 35(11):1073–1082.',
              url: 'https://doi.org/10.1080/02640414.2016.1210197',
              stand: '2017',
            },
            {
              id: bid(),
              text: 'Schoenfeld BJ et al. (2017). Strength and hypertrophy adaptations between low- vs. high-load resistance training. J Strength Cond Res 31(12):3508–3523.',
              stand: '2017',
            },
          ],
        },
        {
          id: bid(),
          type: 'notes',
          text: 'Eigene Notiz: Inhalte prüfen und danach den Prüfstatus auf „Geprüft“ setzen.',
        },
      ],
    };

    await db.pages.bulkAdd([hyper, squat, rm]);

    const ideas: Idea[] = [
      { ...base(), text: 'Seite zu Kreuzbandverletzung & Return-to-Sport anlegen', done: false, pageId: null },
      { ...base(), text: 'Beispielseite „Hypertrophie“ ansehen', done: true, pageId: hyperId },
    ];
    await db.ideas.bulkAdd(ideas);
    await db.meta.put({ key: 'seeded', value: Date.now() });
  });
  return true;
}
