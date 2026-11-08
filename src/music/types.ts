/** One playable thing: an on-demand Audius track or a live radio stream. */
export interface Track {
  /** 'audius:<id>' | 'soma:<id>' | 'radio:<uuid>' */
  id: string;
  kind: 'track' | 'radio';
  title: string;
  artist: string;
  art?: string;
  /** tried in order; radio has mirrors */
  srcs: string[];
  /** seconds; absent for live radio */
  duration?: number;
  genre?: string;
  /** where the item lives on its own site */
  link?: string;
  plays?: number;
  /** a radio's description, or what is on air now */
  note?: string;
}

export interface MusicResponse {
  items: Track[];
  source: string;
  cached: boolean;
  error?: string;
}

export const AUDIUS_GENRES = [
  'Electronic',
  'Lo-Fi',
  'Hip-Hop/Rap',
  'Ambient',
  'House',
  'Techno',
  'Drum & Bass',
  'Alternative',
  'Pop',
  'Rock',
  'R&B/Soul',
  'Jazz',
  'Classical',
  'Soundtrack',
  'Experimental',
] as const;

export const RADIO_TAGS = [
  'lofi',
  'chillout',
  'ambient',
  'jazz',
  'classical',
  'synthwave',
  'electronic',
  'rock',
  'bollywood',
  'hindi',
  'news',
] as const;
