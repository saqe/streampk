// Favorites management with localStorage
const FavoritesManager = {
    STORAGE_KEY: 'liveStreamFavorites',

    // Get all favorite channel IDs
    getFavorites() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading favorites:', e);
            return [];
        }
    },

    // Save favorites to localStorage
    saveFavorites(favorites) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
        } catch (e) {
            console.error('Error saving favorites:', e);
        }
    },

    // Add a channel to favorites
    addFavorite(channelId) {
        const favorites = this.getFavorites();
        if (!favorites.includes(channelId)) {
            favorites.push(channelId);
            this.saveFavorites(favorites);
            return true;
        }
        return false;
    },

    // Remove a channel from favorites
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

    // Toggle favorite status
    toggleFavorite(channelId) {
        if (this.isFavorite(channelId)) {
            this.removeFavorite(channelId);
            return false;
        } else {
            this.addFavorite(channelId);
            return true;
        }
    },

    // Check if a channel is a favorite
    isFavorite(channelId) {
        return this.getFavorites().includes(channelId);
    },

    // Get favorite channels (with full channel data)
    getFavoriteChannels() {
        const favoriteIds = this.getFavorites();
        return favoriteIds
            .map(id => ChannelManager.getChannelById(id))
            .filter(channel => channel !== undefined);
    },

    // Clear all favorites
    clearFavorites() {
        this.saveFavorites([]);
    }
};
