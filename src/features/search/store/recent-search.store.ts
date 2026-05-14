import { create } from "zustand";
import { RecentSearchItem } from "../types/recent-search";
import { RecentSearchService } from "../services/recent-search.service";

interface RecentSearchStore {
    recentSearches: RecentSearchItem[];
    isLoading: boolean;
    loadRecentSearches: () => Promise<void>;
    addRecentSearch: (item: Omit<RecentSearchItem, "timestamp">) => Promise<void>;
    removeRecentSearch: (id: string) => Promise<void>;
    clearRecentSearches: () => Promise<void>;
}

export const useRecentSearchStore = create<RecentSearchStore>((set) => ({
    recentSearches: [],
    isLoading: false,

    loadRecentSearches: async () => {
        set({ isLoading: true });
        const searches = await RecentSearchService.getRecentSearches();
        set({ recentSearches: searches, isLoading: false });
    },

    addRecentSearch: async (item) => {
        const updated = await RecentSearchService.addRecentSearch(item);
        set({ recentSearches: updated });
    },

    removeRecentSearch: async (id) => {
        const updated = await RecentSearchService.removeRecentSearch(id);
        set({ recentSearches: updated });
    },

    clearRecentSearches: async () => {
        await RecentSearchService.clearRecentSearches();
        set({ recentSearches: [] });
    },
}));
