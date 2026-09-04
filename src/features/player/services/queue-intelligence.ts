export interface QueueContext {
  sourceId: string;
  sourceType:
    | "search"
    | "album"
    | "playlist"
    | "daily-mix"
    | "made-for-you"
    | "trending"
    | "radio"
    | "autoplay"
    | "manual";

  seedArtists?: string[];
  seedTrackId?: string;

  recommendationReason?: string;

  generatedAt?: number;
}
