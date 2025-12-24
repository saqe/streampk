// Video Player with JW Player support
const VideoPlayer = {
    player: null,
    currentChannel: null,
    isIframeMode: false,

    // DOM Elements
    elements: {
        playerContainer: null,
        iframe: null,
        overlay: null,
        nowPlaying: null,
        channelName: null,
        channelCategory: null,
        channelAvatar: null
    },

    // Initialize the player
    init() {
        this.elements.playerContainer = document.getElementById('jwPlayer');
        this.elements.iframe = document.getElementById('iframePlayer');
        this.elements.overlay = document.getElementById('playerOverlay');
        this.elements.nowPlaying = document.getElementById('nowPlaying');
        this.elements.channelName = document.getElementById('currentChannelName');
        this.elements.channelCategory = document.getElementById('currentChannelCategory');
        this.elements.channelAvatar = document.getElementById('channelAvatar');
    },

    // Load and play a channel
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

    // Update the "Now Playing" display
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

    // Hide the initial overlay
    hideOverlay() {
        this.elements.overlay.classList.add('hidden');
    },

    // Show error message
    showError(message) {
        this.elements.overlay.classList.remove('hidden');
        this.elements.overlay.innerHTML = `
            <div class="overlay-content">
                <i class="fas fa-exclamation-triangle" style="color: #ff6b6b;"></i>
                <p>${message}</p>
            </div>
        `;
    },

    // Play video
    play() {
        if (this.player && !this.isIframeMode) {
            this.player.play();
        }
    },

    // Pause video
    pause() {
        if (this.player && !this.isIframeMode) {
            this.player.pause();
        }
    },

    // Toggle play/pause
    togglePlay() {
        if (this.player && !this.isIframeMode) {
            if (this.player.getState() === 'playing') {
                this.pause();
            } else {
                this.play();
            }
        }
    },

    // Get current channel
    getCurrentChannel() {
        return this.currentChannel;
    },

    // Load iframe embed
    loadIframeEmbed(channel) {
        this.switchToIframeMode();
        this.elements.iframe.src = channel.embed;
        this.hideOverlay();
    },

    // Switch to video mode (hide iframe, show JW Player)
    switchToVideoMode() {
        this.isIframeMode = false;
        this.elements.playerContainer.style.display = 'block';
        this.elements.iframe.style.display = 'none';
        this.elements.iframe.src = '';
    },

    // Switch to iframe mode (hide JW Player, show iframe)
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
