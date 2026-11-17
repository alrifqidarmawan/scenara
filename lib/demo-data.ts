import type { NoteCardData } from "./types";

/**
 * Seed data for the interactive demo (CLAUDE.md §6F).
 * The demo runs entirely client-side so visitors can test the Fog of War
 * spoiler UX with zero setup — no Supabase rows required.
 */

export interface DemoPersona {
  id: string;
  name: string;
  /** Where this persona has watched up to, in episodes. */
  initialUnit: number;
}

export const DEMO_MEDIA = {
  title: "Severance",
  subtitle: "Season 1",
  mediaType: "tv" as const,
  totalUnits: 9,
};

export const DEMO_PERSONAS: DemoPersona[] = [
  { id: "sarah", name: "Sarah", initialUnit: 2 },
  { id: "alex", name: "Alex", initialUnit: 5 },
];

export const DEMO_NOTES: NoteCardData[] = [
  {
    author_name: "Sarah",
    anchor_unit: 1,
    anchor_label: "Ep 1",
    title: "That opening song",
    tag: "note",
    content:
      "The opening credits song is going to live in my head rent free. Also the waffle party mention in episode one already feels like a clue.",
  },
  {
    author_name: "Sarah",
    anchor_unit: 2,
    anchor_label: "Ep 2",
    title: "The elevator chime",
    tag: "theory",
    content:
      "Theory: the elevator chime changes depending on which direction you're going. Listen next time — it's not the same sound.",
  },
  {
    author_name: "Alex",
    anchor_unit: 2,
    anchor_label: "Ep 2",
    title: "What are the numbers?",
    tag: "question",
    content:
      "Does anyone actually know what the numbers in Macrodata Refinement are supposed to be? The show keeps dodging it.",
  },
  {
    author_name: "Alex",
    anchor_unit: 3,
    anchor_label: "Ep 3",
    title: "Too clean to be real",
    tag: "note",
    content:
      "The office is way too clean for a company this dysfunctional. Every frame looks like a stock photo of a workplace.",
  },
  {
    author_name: "Alex",
    anchor_unit: 4,
    anchor_label: "Ep 4",
    title: "The break room theory",
    tag: "theory",
    content:
      "Theory: the break room isn't a room at all, it's a protocol. Notice we never see a door with that sign on it.",
  },
  {
    author_name: "Alex",
    anchor_unit: 5,
    anchor_label: "Ep 5",
    title: "The dinner party",
    tag: "review",
    content:
      "Best episode so far. The dinner party sequence is genuinely unhinged and I had to pause twice to breathe.",
  },
  {
    author_name: "Sarah",
    anchor_unit: 6,
    anchor_label: "Ep 6",
    title: "Is Helly okay?",
    tag: "question",
    content:
      "Is Helly's outie actually okay? Something felt really off at the end of that scene and nobody is talking about it.",
  },
  {
    author_name: "Alex",
    anchor_unit: 7,
    anchor_label: "Ep 7",
    title: "The map is a loop",
    tag: "theory",
    content:
      "Theory: the map in the archives is the same shape as the outdoor retreat route. It's all one loop.",
  },
  {
    author_name: "Sarah",
    anchor_unit: 9,
    anchor_label: "Ep 9",
    title: "That finale",
    tag: "review",
    content:
      "THAT finale. I need everyone to catch up immediately so we can talk about it. No spoilers until then, obviously.",
  },
];
