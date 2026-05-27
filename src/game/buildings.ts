import type { BuildingId } from "./store";
import type { QuestId } from "./quests";

export interface BuildingDef {
  id: BuildingId;
  label: string;
  /** Short tagline shown in the interaction prompt. */
  blurb: string;
  /** World position of the building's center [x, y, z]. */
  position: [number, number, number];
  /** Box footprint half-extents [x, y, z] — drives the body + sensor colliders. */
  size: [number, number, number];
  /**
   * Optional authored house model (GLB) under /public. When present AND it
   * loads, it replaces the procedural cottage; otherwise the polished
   * procedural cottage is shown. Leave undefined to always use procedural.
   */
  model?: string;
  /** The in-world quest this cottage offers, if any (shown in its panel). */
  quest?: QuestId;
  /** Procedural-cottage palette (wall + roof) used when no model is loaded. */
  color: string;
  roof: string;
  /** Icon path in /public/icons. */
  icon: string;
}

/**
 * The six cottages, ringing the village green (origin) and facing inward.
 * Layout constants that depend on these positions live in src/world/layout.ts.
 * Spawn is at the south gate (+Z); the Bug Hunt field is north, past Home.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: "about",
    label: "Home / About",
    blurb: "Who is Diwakar?",
    position: [0, 0, -7],
    size: [2.3, 1.9, 2.3],
    color: "#e9b7a0",
    roof: "#c8745f",
    icon: "/icons/about.png",
  },
  {
    id: "experience",
    label: "Experience",
    blurb: "Senior Software Engineer @ Bajaj Finserv Direct",
    position: [-9, 0, -4],
    size: [2.2, 2.6, 2.2],
    quest: "bug-hunt",
    color: "#cdbce8",
    roof: "#8e6fb0",
    icon: "/icons/experience.png",
  },
  {
    id: "projects",
    label: "Projects",
    blurb: "Metapod · Krypto-Tracker · PseudoServe",
    position: [9, 0, -4],
    size: [2.4, 1.8, 2.4],
    quest: "kafka-courier",
    color: "#f0c987",
    roof: "#cf9b48",
    icon: "/icons/projects.png",
  },
  {
    id: "skills",
    label: "Skills",
    blurb: "The tech garden",
    position: [-9, 0, 4],
    size: [2.2, 1.7, 2.2],
    quest: "cache-match",
    color: "#9fcf9a",
    roof: "#6fae6a",
    icon: "/icons/skills.png",
  },
  {
    id: "awards",
    label: "Awards & Research",
    blurb: "Recognition & research",
    position: [9, 0, 4],
    size: [2.1, 2.0, 2.1],
    color: "#e8c0c0",
    roof: "#c98a8a",
    icon: "/icons/awards.png",
  },
  {
    id: "contact",
    label: "Contact",
    blurb: "Send a letter",
    // Off the central entrance axis (it used to wall off the path into town).
    position: [6, 0, 9],
    size: [1.9, 1.5, 1.9],
    color: "#bcd9e8",
    roof: "#7fa8c0",
    icon: "/icons/contact.png",
  },
];

export const getBuilding = (id: BuildingId): BuildingDef =>
  BUILDINGS.find((b) => b.id === id)!;
