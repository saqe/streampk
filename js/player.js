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
        overlayError: null
    },

    /**
     * Initializes the player by caching DOM element references.
     * Must be called before using other player methods.
     */
    init() {
        this.elements.playerContainer = document.getElementById('jwPlayer');
        this.elements.iframe = document.getElementById('iframePlayer');
        this.elements.overlay = document.getElementById('playerOverlay');
        this.elements.overlayError = document.getElementById('overlayError');

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
        // The player shows its own buffering spinner, so just clear any idle/error screen
        this.setOverlay('hidden');

        // Check if this is an iframe embed channel
        if (channel.embed) {
            this.loadIframeEmbed(channel);
            return;
        }

        // Switch to video mode
        this.switchToVideoMode();

        if (typeof jwplayer !== 'function') {
            this.showError('The video player failed to load');
            return;
        }

        // Setup JW Player with the stream
        this.player = jwplayer('jwPlayer').setup({
            title: channel.name,
            file: channel.stream,
            width: '100%',
            height: '100%',
            autostart: true,
            androidhls: true,
            stretching: 'uniform',
            skin: 'seven'
        });

        this.player.on('error', (e) => {
            console.error('JW Player error:', e);
            this.showError('This stream is unavailable right now');
        });

        this.player.on('setupError', (e) => {
            console.error('JW Player setup error:', e);
            this.showError('This stream could not be loaded');
        });
    },

    /**
     * Reloads the current channel.
     */
    retry() {
        if (this.currentChannel) this.loadChannel(this.currentChannel);
    },

    /**
     * Sets the overlay state: 'idle', 'error' or 'hidden'.
     * @param {string} state
     * @private
     */
    setOverlay(state) {
        this.elements.overlay.dataset.state = state;
    },

    /**
     * Displays an error message in the player overlay.
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.elements.overlayError.textContent = message;
        this.setOverlay('error');
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
    },

    /**
     * Switches to video mode (JW Player).
     * Hides iframe and clears its source.
     * @private
     */
    switchToVideoMode() {
        this.isIframeMode = false;
        this.elements.playerContainer = document.getElementById('jwPlayer');
        this.elements.playerContainer.style.display = 'block';
        this.elements.iframe.hidden = true;
        this.elements.iframe.removeAttribute('src');
    },

    /**
     * Switches to iframe embed mode.
     * Removes JW Player instance and shows iframe.
     * @private
     */
    switchToIframeMode() {
        this.isIframeMode = true;
        if (this.player) {
            this.player.remove();
            this.player = null;
        }
        // JW Player replaces the container element; re-query it
        this.elements.playerContainer = document.getElementById('jwPlayer');
        if (this.elements.playerContainer) this.elements.playerContainer.style.display = 'none';
        this.elements.iframe.hidden = false;
    }
};
