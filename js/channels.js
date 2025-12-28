/**
 * @fileoverview Channel data management module for the live streaming application.
 * Handles loading, parsing, and querying channel data from M3U8 playlists.
 */

/**
 * @typedef {Object} Channel
 * @property {string} id - Unique channel identifier (from tvg-id)
 * @property {string} name - Display name of the channel (from tvg-name)
 * @property {string} category - Channel category/group (from group-title)
 * @property {string} [logo] - URL to channel logo image (from tvg-logo)
 * @property {string} [stream] - HLS stream URL (.m3u8)
 * @property {string} [embed] - Alternative iframe embed URL
 */

/**
 * Singleton manager for channel data operations.
 * Loads channels from M3U8 playlist and provides query methods.
 * @namespace
 */
const ChannelManager = {
    /**
     * Array of loaded channel objects
     * @type {Channel[]}
     */
    channels: [],

    /**
     * Flag indicating whether channels have been loaded
     * @type {boolean}
     */
    loaded: false,

    /**
     * Parses M3U8 playlist content and extracts channel data.
     * Expects EXTINF format with tvg-id, tvg-name, tvg-logo, and group-title attributes.
     * @param {string} content - Raw M3U8 playlist content
     * @returns {Channel[]} Array of parsed channel objects
     */
    parseM3U8(content) {
        const channels = [];
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('#EXTINF:')) {
                // Parse EXTINF line for metadata
                const channel = {};

                // Extract tvg-id
                const idMatch = line.match(/tvg-id="([^"]+)"/);
                if (idMatch) channel.id = idMatch[1];

                // Extract tvg-name
                const nameMatch = line.match(/tvg-name="([^"]+)"/);
                if (nameMatch) channel.name = nameMatch[1];

                // Extract tvg-logo
                const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                if (logoMatch) channel.logo = logoMatch[1];

                // Extract group-title (category)
                const groupMatch = line.match(/group-title="([^"]+)"/);
                if (groupMatch) channel.category = groupMatch[1];

                // Fallback: extract name from end of line after comma
                if (!channel.name) {
                    const commaIndex = line.lastIndexOf(',');
                    if (commaIndex !== -1) {
                        channel.name = line.substring(commaIndex + 1).trim();
                    }
                }

                // Next non-comment line should be the stream URL
                if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
                    channel.stream = lines[i + 1];
                    i++; // Skip the URL line
                }

                // Only add if we have required fields
                if (channel.id && channel.name && channel.stream) {
                    channels.push(channel);
                }
            }
        }

        return channels;
    },

    /**
     * Loads channels from the playlist.m3u8 file.
     * Fetches the playlist from the server and parses it.
     * Only loads once; subsequent calls return cached data.
     * @async
     * @returns {Promise<Channel[]>} Array of loaded channel objects
     */
    async loadChannels() {
        if (this.loaded) return this.channels;

        try {
            const response = await fetch('playlist.m3u8');
            if (!response.ok) {
                throw new Error(`Failed to load playlist: ${response.status}`);
            }
            const content = await response.text();
            this.channels = this.parseM3U8(content);
            this.loaded = true;
            console.log(`Loaded ${this.channels.length} channels from playlist.m3u8`);
        } catch (error) {
            console.error('Error loading playlist:', error);
            this.channels = [];
            this.loaded = true;
        }

        return this.channels;
    },

    /**
     * Gets all loaded channels.
     * @returns {Channel[]} Array of all channel objects
     */
    getChannels() {
        return this.channels;
    },

    /**
     * Gets all unique categories from loaded channels.
     * @returns {string[]} Alphabetically sorted array of category names
     */
    getCategories() {
        const categories = [...new Set(this.channels.map(ch => ch.category))];
        return categories.sort();
    },

    /**
     * Gets channels filtered by category.
     * @param {string} category - Category name to filter by, or 'all' for all channels
     * @returns {Channel[]} Array of channels in the specified category
     */
    getChannelsByCategory(category) {
        if (category === 'all') {
            return this.channels;
        }
        return this.channels.filter(ch => ch.category === category);
    },

    /**
     * Finds a channel by its unique identifier.
     * @param {string} id - Channel ID to search for
     * @returns {Channel|undefined} The channel object, or undefined if not found
     */
    getChannelById(id) {
        return this.channels.find(ch => ch.id === id);
    },

    /**
     * Gets channels that have valid stream URLs.
     * @returns {Channel[]} Array of channels with non-empty stream property
     */
    getActiveChannels() {
        return this.channels.filter(ch => ch.stream && ch.stream.length > 0);
    },

    /**
     * Gets the total number of loaded channels.
     * @returns {number} Total channel count
     */
    getChannelCount() {
        return this.channels.length;
    },

    /**
     * Gets the number of channels with valid streams.
     * @returns {number} Active channel count
     */
    getActiveChannelCount() {
        return this.getActiveChannels().length;
    }
};
