/**
 * @fileoverview Favorites management module for the live streaming application.
 * Handles persisting and retrieving user's favorite channels using localStorage.
 */

/**
 * Singleton manager for favorites persistence.
 * Stores favorite channel IDs in localStorage and provides CRUD operations.
 * @namespace
 */
const FavoritesManager = {
    /**
     * localStorage key for favorites data
     * @type {string}
     * @constant
     */
    STORAGE_KEY: 'liveStreamFavorites',

    /**
     * Retrieves all favorite channel IDs from localStorage.
     * @returns {string[]} Array of favorite channel IDs
     */
    getFavorites() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading favorites:', e);
            return [];
        }
    },

    /**
     * Saves favorite channel IDs to localStorage.
     * @param {string[]} favorites - Array of channel IDs to save
     */
    saveFavorites(favorites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        } catch (e) {
            console.error('Error saving favorites:', e);
        }
    },

    /**
     * Adds a channel to favorites if not already present.
     * @param {string} channelId - Channel ID to add
     * @returns {boolean} True if added, false if already a favorite
     */
    addFavorite(channelId) {
        const favorites = this.getFavorites();
        if (!favorites.includes(channelId)) {
            favorites.push(channelId);
            this.saveFavorites(favorites);
            return true;
        }
        return false;
    },

    /**
     * Removes a channel from favorites.
     * @param {string} channelId - Channel ID to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeFavorite(channelId) {
        const favorites = this.getFavorites();
        const index = favorites.indexOf(channelId);
        if (index > -1) {
            favorites.splice(index, 1);
            this.saveFavorites(favorites);
            return true;
        }
        return false;
    },

    /**
     * Toggles favorite status for a channel.
     * Adds if not a favorite, removes if already a favorite.
     * @param {string} channelId - Channel ID to toggle
     * @returns {boolean} True if now a favorite, false if removed
     */
    toggleFavorite(channelId) {
        if (this.isFavorite(channelId)) {
            this.removeFavorite(channelId);
            return false;
        } else {
            this.addFavorite(channelId);
            return true;
        }
    },

    /**
     * Checks if a channel is marked as favorite.
     * @param {string} channelId - Channel ID to check
     * @returns {boolean} True if the channel is a favorite
     */
    isFavorite(channelId) {
        return this.getFavorites().includes(channelId);
    },

    /**
     * Gets full channel objects for all favorites.
     * Filters out any favorites whose channels no longer exist.
     * @returns {Channel[]} Array of favorite channel objects
     */
    getFavoriteChannels() {
        const favoriteIds = this.getFavorites();
        return favoriteIds
            .map(id => ChannelManager.getChannelById(id))
            .filter(channel => channel !== undefined);
    },

    /**
     * Clears all favorites from storage.
     */
    clearFavorites() {
        this.saveFavorites([]);
    }
};
