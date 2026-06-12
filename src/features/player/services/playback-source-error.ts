export type PlaybackSourceErrorCategory =
  | 'SOURCE_MISSING'
  | 'SOURCE_EXPIRED'
  | 'SOURCE_INVALID'
  | 'LOCAL_FILE_MISSING'
  | 'RESOLVE_FAILED'
  | 'NETWORK_UNAVAILABLE';

export class PlaybackSourceError extends Error {
  category: PlaybackSourceErrorCategory;
  trackId: string;

  constructor(category: PlaybackSourceErrorCategory, trackId: string, message?: string) {
    super(message || `Playback source error: ${category} for track ${trackId}`);
    this.name = "PlaybackSourceError";
    this.category = category;
    this.trackId = trackId;
    Object.setPrototypeOf(this, PlaybackSourceError.prototype);
  }
}
