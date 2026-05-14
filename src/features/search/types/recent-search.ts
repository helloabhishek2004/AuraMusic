export type RecentSearchType = "song" | "artist" | "album" | "playlist";

export interface RecentSearchItem {
    id: string;
    type: RecentSearchType;
    title: string;
    subtitle?: string;
    thumbnail: string;
    timestamp: number;
    // Data needed for navigation or playback
    data: any;
}
