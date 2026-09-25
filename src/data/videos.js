/**
 * Trusted YouTube training video catalog.
 * Only these IDs may be embedded — never inject arbitrary URLs.
 * Uses youtube-nocookie.com for privacy-enhanced embeds.
 */
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export const TRAINING_VIDEOS = [
  {
    id: 'VqTdJhUhR-g',
    title: 'Fire Extinguisher Training — PASS Method',
    category: 'Fire Safety',
    description: 'Learn the Pull, Aim, Squeeze, Sweep technique for portable extinguishers.',
  },
  {
    id: 'ULPAtTM-xc8',
    title: 'Workplace Fire Safety Basics',
    category: 'Fire Safety',
    description: 'Recognizing fire hazards and emergency response in industrial settings.',
  },
  {
    id: 'a3a4hQ2jH2I',
    title: 'Personal Protective Equipment (PPE)',
    category: 'PPE',
    description: 'Selecting and wearing the right PPE for industrial work.',
  },
  {
    id: 'pWobp3xqQ5Y',
    title: 'Confined Space Entry Awareness',
    category: 'Gas Safety',
    description: 'Hazards of confined spaces, atmosphere testing, and permit systems.',
  },
  {
    id: 'gH5R7T_5y5k',
    title: 'Lockout / Tagout Overview',
    category: 'Machinery Safety',
    description: 'Energy isolation procedures to prevent unexpected machinery start-up.',
  },
  {
    id: 'H3T8_9qJkYc',
    title: 'Emergency Evacuation Procedures',
    category: 'Emergency Response',
    description: 'Assembly points, alarm response, and orderly evacuation.',
  },
].filter((v) => VIDEO_ID_RE.test(v.id));

export function isValidVideoId(id) {
  return typeof id === 'string' && VIDEO_ID_RE.test(id);
}

export function getEmbedUrl(videoId) {
  if (!isValidVideoId(videoId)) return null;
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}
