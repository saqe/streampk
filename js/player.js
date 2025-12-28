/**
 * @fileoverview Video player module for the live streaming application.
 * Provides a wrapper around JW Player with iframe fallback support.
 */

/**
 * Singleton video player controller.
 * Manages HLS stream playback via JW Player and iframe embeds for alternative sources.
 * @namespace
 */
const VideoPlayer = {
    /**
     * JW Player instance (null when using iframe mode)
     * @type {Object|null}
     */
    player: null,

    /**
     * Currently playing channel object
     * @type {Channel|null}
     */
    currentChannel: null,

    /**
     * Flag indicating if player is in iframe embed mode
     * @type {boolean}
     */
    isIframeMode: false,

    /**
     * Cached DOM element references
     * @type {Object}
     */
    elements: {
        playerContainer: null,
        iframe: null,
        overlay: null,
        nowPlaying: null,
        channelName: null,
        channelCategory: null,
        channelAvatar: null
    },

    /**
     * Initializes the player by caching DOM element references.
     * Must be called before using other player methods.
     */
    init() {
        this.elements.playerContainer = document.getElementById('jwPlayer');
        this.elements.iframe = document.getElementById('iframePlayer');
        this.elements.overlay = document.getElementById('playerOverlay');
        this.elements.nowPlaying = document.getElementById('nowPlaying');
        this.elements.channelName = document.getElementById('currentChannelName');
        this.elements.channelCategory = document.getElementById('currentChannelCategory');
        this.elements.channelAvatar = document.getElementById('channelAvatar');
    },

    /**
     * Loads and plays a channel's stream or embed.
     * Automatically selects HLS or iframe mode based on channel configuration.
     * @param {Channel} channel - Channel object to play
     */
    loadChannel(channel) {
        if (!channel || (!channel.stream && !channel.embed)) {
            this.showError('No stream available for this channel');
            return;
        }

        this.currentChannel = channel;
        this.updateNowPlaying(channel);

        // Check if this is an iframe embed channel
        if (channel.embed) {
            this.loadIframeEmbed(channel);
            return;
        }

        // Switch to video mode
        this.switchToVideoMode();

        // Setup JW Player with the stream
        this.player = jwplayer('jwPlayer').setup({
            title: channel.name,
            file: channel.stream,
            width: '100%',
            height: '100%',
            autostart: true,
            androidhls: true,
            stretching: 'exactfit',
            skin: 'seven'
        });

        // Set up event listeners
        this.player.on('play', () => {
            this.hideOverlay();
        });

        this.player.on('error', (e) => {
            console.error('JW Player error:', e);
            this.showError('Stream unavailable');
        });

        this.hideOverlay();
    },

    /**
     * Updates the "Now Playing" display with channel information.
     * @param {Channel} channel - Channel to display
     * @private
     */
    updateNowPlaying(channel) {
        this.elements.channelName.textContent = channel.name;
        this.elements.channelCategory.textContent = channel.category;

        // Update avatar with channel logo
        if (channel.logo) {
            this.elements.channelAvatar.innerHTML = `<img src="${channel.logo}" alt="${channel.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-tv\\'></i>'">`;
        } else {
            this.elements.channelAvatar.innerHTML = '<i class="fas fa-tv"></i>';
        }
    },

    /**
     * Hides the player overlay (loading/error state).
     * @private
     */
    hideOverlay() {
        this.elements.overlay.classList.add('hidden');
    },

    /**
     * Displays an error message in the player overlay.
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.elements.overlay.classList.remove('hidden');
        this.elements.overlay.innerHTML = `
            <div class="overlay-content">
                <i class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
                <p>${message}</p>
            </div>
        `;
    },

    /**
     * Plays the current video (HLS mode only).
     * No effect in iframe mode.
     */
    play() {
        if (this.player && !this.isIframeMode) {
            this.player.play();
        }
    },

    /**
     * Pauses the current video (HLS mode only).
     * No effect in iframe mode.
     */
    pause() {
        if (this.player && !this.isIframeMode) {
            this.player.pause();
        }
    },

    /**
     * Toggles between play and pause states (HLS mode only).
     * No effect in iframe mode.
     */
    togglePlay() {
        if (this.player && !this.isIframeMode) {
            if (this.player.getState() === 'playing') {
                this.pause();
            } else {
                this.play();
            }
        }
    },

    /**
     * Gets the currently playing channel.
     * @returns {Channel|null} Current channel object, or null if none
     */
    getCurrentChannel() {
        return this.currentChannel;
    },

    /**
     * Loads a channel using iframe embed mode.
     * @param {Channel} channel - Channel with embed URL to load
     * @private
     */
    loadIframeEmbed(channel) {
        this.switchToIframeMode();
        this.elements.iframe.src = channel.embed;
        this.hideOverlay();
    },

    /**
     * Switches to video mode (JW Player).
     * Hides iframe and clears its source.
     * @private
     */
    switchToVideoMode() {
        this.isIframeMode = false;
        this.elements.playerContainer.style.display = 'block';
        this.elements.iframe.style.display = 'none';
        this.elements.iframe.src = '';
    },

    /**
     * Switches to iframe embed mode.
     * Removes JW Player instance and shows iframe.
     * @private
     */
    switchToIframeMode() {
        this.isIframeMode = true;
        this.elements.playerContainer.style.display = 'none';
        if (this.player) {
            this.player.remove();
            this.player = null;
        }
        this.elements.iframe.style.display = 'block';
    }
};
