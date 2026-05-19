import AsyncStorage from "@react-native-async-storage/async-storage";
import { RecentSearchItem } from "../types/recent-search";

const RECENT_SEARCHES_KEY = "@aura_recent_searches";
const MAX_RECENT_SEARCHES = 20;

export const RecentSearchService = {
    async getRecentSearches(): Promise<RecentSearchItem[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            return jsonValue ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error("[RecentSearchService] Failed to load searches", e);
            return [];
        }
    },

    async addRecentSearch(item: Omit<RecentSearchItem, "timestamp">): Promise<RecentSearchItem[]> {
        try {
            const searches = await this.getRecentSearches();
            
            // Filter out exact duplicate (same ID AND type)
            const filtered = searches.filter((s) => !(s.id === item.id && s.type === item.type));
            
            const newItem: RecentSearchItem = {
                ...item,
                timestamp: Date.now(),
            };
            
            const updated = [newItem, ...filtered].slice(0, MAX_RECENT_SEARCHES);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.error("[RecentSearchService] Failed to add search", e);
            return [];
        }
    },

    async removeRecentSearch(id: string): Promise<RecentSearchItem[]> {
        try {
            const searches = await this.getRecentSearches();
            const updated = searches.filter((s) => s.id !== id);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.error("[RecentSearchService] Failed to remove search", e);
            return [];
        }
    },

    async clearRecentSearches(): Promise<void> {
        try {
            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
        } catch (e) {
            console.error("[RecentSearchService] Failed to clear searches", e);
        }
    },
};
