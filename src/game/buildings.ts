import type { BuildingId } from "./store";

export interface BuildingDef {
  id: BuildingId;
  label: string;
  /** Short tagline shown in the interaction prompt. */
  blurb: string;
  /** World position of the building's center [x, y, z]. */
  position: [number, number, number];
  /** Box footprint half-extents [x, y, z] used for the placeholder mesh + body collider. */
  size: [number, number, number];
  /** Placeholder palette color (replaced by sourced models in the art pass). */
  color: string;
  /** Roof accent color for the placeholder. */
  roof: string;
  /** Icon path in /public/icons. */
  icon: string;
}

/**
 * The six buildings, laid out roughly per the approved world map.
 * Spawn is at About/Home (town center, +Z so the player faces it).
 * Positions are on the XZ ground plane; Y is the building base height.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: "about",
    label: "Home / About",
    blurb: "Who is Diwakar?",
    position: [0, 0, 0],
    size: [2, 1.6, 2],
    color: "#e9b7a0",
    roof: "#c8745f",
    icon: "/icons/about.png",
  },
  {
    id: "experience",
    label: "Experience",
    blurb: "Senior Software Engineer @ Bajaj Finserv Direct",
    position: [-12, 0, -8],
    size: [2.2, 2.4, 2.2],
    color: "#cdbce8",
    roof: "#8e6fb0",
    icon: "/icons/experience.png",
  },
  {
    id: "projects",
    label: "Projects",
    blurb: "Metapod · Krypto-Tracker · PseudoServe",
    position: [12, 0, -8],
    size: [2.4, 1.8, 2.4],
    color: "#f0c987",
    roof: "#cf9b48",
    icon: "/icons/projects.png",
  },
  {
    id: "skills",
    label: "Skills",
    blurb: "The tech garden",
    position: [-13, 0, 6],
    size: [2.2, 1.6, 2.2],
    color: "#9fcf9a",
    roof: "#6fae6a",
    icon: "/icons/skills.png",
  },
  {
    id: "awards",
    label: "Awards & Research",
    blurb: "Recognition & research",
    position: [13, 0, 6],
    size: [2, 1.8, 2],
    color: "#e8c0c0",
    roof: "#c98a8a",
    icon: "/icons/awards.png",
  },
  {
    id: "contact",
    label: "Contact",
    blurb: "Send a letter",
    position: [0, 0, 14],
    size: [1.8, 1.4, 1.8],
    color: "#bcd9e8",
    roof: "#7fa8c0",
    icon: "/icons/contact.png",
  },
];

export const getBuilding = (id: BuildingId): BuildingDef =>
  BUILDINGS.find((b) => b.id === id)!;
