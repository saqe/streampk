/**
 * @fileoverview Main application controller for the live streaming application.
 * Handles UI rendering, event handling, and coordinates between other modules.
 */

/**
 * Main application singleton.
 * Bootstraps the app, manages UI state, and coordinates between modules.
 * @namespace
 */
const App = {
    /**
     * localStorage key for theme preference
     * @type {string}
     * @constant
     */
    THEME_KEY: 'liveStreamTheme',

    /**
     * Currently selected category filter ('all' or category name)
     * @type {string}
     */
    currentCategory: 'all',

    /**
     * Index of keyboard-selected channel (-1 = none)
     * @type {number}
     */
    selectedIndex: -1,

    /**
     * Cached array of channel card DOM elements
     * @type {HTMLElement[]}
     */
    channelCards: [],

    /**
     * Cached DOM element references
     * @type {Object}
     */
    elements: {
        themeToggle: null,
        themeIcon: null,
        categoryTabs: null,
        channelGrid: null,
        favoritesSection: null,
        favoritesGrid: null
    },

    /**
     * Initializes the application.
     * Loads channels, initializes components, and sets up event listeners.
     * @async
     */
    async init() {
        // Cache DOM elements
        this.elements.themeToggle = document.getElementById('themeToggle');
        this.elements.themeIcon = document.getElementById('themeIcon');
        this.elements.categoryTabs = document.getElementById('categoryTabs');
        this.elements.channelGrid = document.getElementById('channelGrid');
        this.elements.favoritesSection = document.getElementById('favoritesSection');
        this.elements.favoritesGrid = document.getElementById('favoritesGrid');

        // Load channels from playlist.m3u8
        await ChannelManager.loadChannels();

        // Initialize components
        VideoPlayer.init();
        this.loadTheme();
        this.renderCategoryTabs();
        this.renderChannels();
        this.renderFavorites();
        this.setupEventListeners();

        // Auto-play first available channel
        this.autoPlayFirstChannel();

        console.log(`StreamPK loaded. ${ChannelManager.getActiveChannelCount()}/${ChannelManager.getChannelCount()} channels available.`);
    },

    /**
     * Sets up global event listeners for theme toggle, keyboard navigation, and share.
     * @private
     */
    setupEventListeners() {
        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareChannel());
        }
    },

    /**
     * Shares the currently playing channel via Web Share API or clipboard.
     * Generates a deep link URL with the channel ID parameter.
     */
    shareChannel() {
        const currentChannel = VideoPlayer.getCurrentChannel();
        if (!currentChannel) {
            alert('No channel is currently playing');
            return;
        }

        const shareUrl = `${window.location.origin}${window.location.pathname}?channel=${currentChannel.id}`;

        // Use Web Share API if available (mobile)
        if (navigator.share) {
            navigator.share({
                title: currentChannel.name,
                url: shareUrl
            }).catch(() => {});
        } else {
            // Fallback: copy to clipboard using textarea trick
            this.copyToClipboard(shareUrl);
        }
    },

    /**
     * Copies text to clipboard using legacy execCommand for HTTP compatibility.
     * Falls back to prompt dialog if copy fails.
     * @param {string} text - Text to copy
     * @private
     */
    copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            alert('Link copied to clipboard!');
        } catch (err) {
            prompt('Copy this link:', text);
        }

        document.body.removeChild(textarea);
    },

    /**
     * Loads theme preference from localStorage and applies it.
     * Defaults to dark theme if no preference saved.
     * @private
     */
    loadTheme() {
        const savedTheme = localStorage.getItem(this.THEME_KEY) || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    },

    /**
     * Toggles between dark and light themes.
     * Persists preference to localStorage.
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        html.setAttribute('data-theme', newTheme);
        localStorage.setItem(this.THEME_KEY, newTheme);
        this.updateThemeIcon(newTheme);
    },

    /**
     * Updates the theme toggle button icon.
     * @param {string} theme - Current theme ('dark' or 'light')
     * @private
     */
    updateThemeIcon(theme) {
        this.elements.themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    },

    /**
     * Renders category filter tabs from available channels.
     * Includes an 'All' tab plus one tab per unique category.
     */
    renderCategoryTabs() {
        const categories = ChannelManager.getCategories();
        const tabsHtml = categories.map(category =>
            `<button class="category-tab" data-category="${category}">${category}</button>`
        ).join('');

        this.elements.categoryTabs.innerHTML =
            `<button class="category-tab active" data-category="all">All</button>` + tabsHtml;

        // Add click handlers
        this.elements.categoryTabs.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.selectCategory(tab.dataset.category);
            });
        });
    },

    /**
     * Selects a category and updates the UI.
     * @param {string} category - Category to select ('all' or category name)
     */
    selectCategory(category) {
        this.currentCategory = category;

        // Update active tab
        this.elements.categoryTabs.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });

        // Re-render channels
        this.renderChannels();
        this.selectedIndex = -1;
    },

    // Render channel grid
    renderChannels() {
        const channels = ChannelManager.getChannelsByCategory(this.currentCategory);

        if (channels.length === 0) {
            this.elements.channelGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tv"></i>
                    <p>No channels in this category</p>
                </div>
            `;
            this.channelCards = [];
            return;
        }

        const currentChannel = VideoPlayer.getCurrentChannel();

        this.elements.channelGrid.innerHTML = channels.map((channel, index) => {
            const isActive = currentChannel && currentChannel.id === channel.id;
            const isFavorite = FavoritesManager.isFavorite(channel.id);
            const hasStream = (channel.stream && channel.stream.length > 0) || channel.embed;

            return `
                <div class="channel-card ${isActive ? 'active' : ''} ${!hasStream ? 'no-stream' : ''}"
                     data-channel-id="${channel.id}"
                     data-index="${index}">
                    <button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}"
                            data-channel-id="${channel.id}"
                            title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <i class="fas fa-star"></i>
                    </button>
                    <div class="channel-logo">
                        ${channel.logo
                            ? `<img src="${channel.logo}" alt="${channel.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-tv\\'></i>'">`
                            : '<i class="fas fa-tv"></i>'}
                    </div>
                    <span class="channel-name" title="${channel.name}">${channel.name}</span>
                    <span class="channel-category">${channel.category}</span>
                </div>
            `;
        }).join('');

        // Cache channel cards
        this.channelCards = Array.from(this.elements.channelGrid.querySelectorAll('.channel-card'));

        // Add click handlers
        this.channelCards.forEach(card => {
            card.addEventListener('click', (e) => {
                // Check if favorite button was clicked
                if (e.target.closest('.favorite-btn')) {
                    return;
                }
                const channelId = card.dataset.channelId;
                this.playChannel(channelId);
            });
        });

        // Add favorite button handlers
        this.elements.channelGrid.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const channelId = btn.dataset.channelId;
                this.toggleFavorite(channelId);
            });
        });
    },

    // Play a channel
    playChannel(channelId) {
        const channel = ChannelManager.getChannelById(channelId);
        if (!channel) return;

        if (!channel.stream && !channel.embed) {
            alert('This channel does not have a stream URL configured yet.');
            return;
        }

        VideoPlayer.loadChannel(channel);

        // Update active state in UI
        this.channelCards.forEach(card => {
            card.classList.toggle('active', card.dataset.channelId === channelId);
        });

        // Update selected index
        const cardIndex = this.channelCards.findIndex(card => card.dataset.channelId === channelId);
        if (cardIndex !== -1) {
            this.selectedIndex = cardIndex;
        }
    },

    // Toggle favorite
    toggleFavorite(channelId) {
        const isFavorite = FavoritesManager.toggleFavorite(channelId);

        // Update button in channel grid
        const btn = this.elements.channelGrid.querySelector(`.favorite-btn[data-channel-id="${channelId}"]`);
        if (btn) {
            btn.classList.toggle('is-favorite', isFavorite);
            btn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
        }

        // Re-render favorites section
        this.renderFavorites();
    },

    // Render favorites section
    renderFavorites() {
        const favorites = FavoritesManager.getFavoriteChannels();

        if (favorites.length === 0) {
            this.elements.favoritesSection.classList.remove('has-favorites');
            this.elements.favoritesGrid.innerHTML = '';
            return;
        }

        this.elements.favoritesSection.classList.add('has-favorites');

        this.elements.favoritesGrid.innerHTML = favorites.map(channel => `
            <div class="favorite-card" data-channel-id="${channel.id}">
                <div class="channel-logo">
                    ${channel.logo
                        ? `<img src="${channel.logo}" alt="${channel.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-tv\\'></i>'">`
                        : '<i class="fas fa-tv"></i>'}
                </div>
                <span class="channel-name" title="${channel.name}">${channel.name}</span>
            </div>
        `).join('');

        // Add click handlers
        this.elements.favoritesGrid.querySelectorAll('.favorite-card').forEach(card => {
            card.addEventListener('click', () => {
                const channelId = card.dataset.channelId;
                this.playChannel(channelId);
            });
        });
    },

    // Handle keyboard navigation
    handleKeyboard(e) {
        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        const totalCards = this.channelCards.length;
        if (totalCards === 0) return;

        switch (e.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                e.preventDefault();
                this.navigateChannels(-1);
                break;
            case 'ArrowDown':
            case 'ArrowRight':
                e.preventDefault();
                this.navigateChannels(1);
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.selectedIndex < totalCards) {
                    const channelId = this.channelCards[this.selectedIndex].dataset.channelId;
                    this.playChannel(channelId);
                }
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.toggleCurrentFavorite();
                break;
            case ' ':
                e.preventDefault();
                VideoPlayer.togglePlay();
                break;
            default:
                // Number keys 1-9 for quick select
                const num = parseInt(e.key);
                if (num >= 1 && num <= 9 && num <= totalCards) {
                    e.preventDefault();
                    const channelId = this.channelCards[num - 1].dataset.channelId;
                    this.playChannel(channelId);
                    this.selectedIndex = num - 1;
                    this.updateSelectedState();
                }
                break;
        }
    },

    // Navigate channels with keyboard
    navigateChannels(direction) {
        const totalCards = this.channelCards.length;

        if (this.selectedIndex === -1) {
            this.selectedIndex = direction === 1 ? 0 : totalCards - 1;
        } else {
            this.selectedIndex += direction;
            if (this.selectedIndex < 0) this.selectedIndex = totalCards - 1;
            if (this.selectedIndex >= totalCards) this.selectedIndex = 0;
        }

        this.updateSelectedState();
        this.scrollToSelected();
    },

    // Update selected visual state
    updateSelectedState() {
        this.channelCards.forEach((card, index) => {
            card.classList.toggle('selected', index === this.selectedIndex);
        });
    },

    // Scroll to selected card
    scrollToSelected() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.channelCards.length) {
            this.channelCards[this.selectedIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    },

    // Toggle favorite for current/selected channel
    toggleCurrentFavorite() {
        let channelId = null;

        // If a channel is playing, toggle that
        const currentChannel = VideoPlayer.getCurrentChannel();
        if (currentChannel) {
            channelId = currentChannel.id;
        }
        // Otherwise toggle the selected channel
        else if (this.selectedIndex >= 0 && this.selectedIndex < this.channelCards.length) {
            channelId = this.channelCards[this.selectedIndex].dataset.channelId;
        }

        if (channelId) {
            this.toggleFavorite(channelId);
        }
    },

    // Auto-play first available channel on load
    autoPlayFirstChannel() {
        // Check for channel in URL parameter first
        const urlParams = new URLSearchParams(window.location.search);
        const channelId = urlParams.get('channel');

        if (channelId) {
            const channel = ChannelManager.getChannelById(channelId);
            if (channel && (channel.stream || channel.embed)) {
                console.log('Playing channel from URL:', channelId);
                this.playChannel(channelId);
                return;
            } else {
                console.log('Channel not found or has no stream:', channelId);
            }
        }

        // Otherwise play Dunya News as default channel
        const defaultChannel = ChannelManager.getChannelById('dunya-news');
        if (defaultChannel && (defaultChannel.stream || defaultChannel.embed)) {
            console.log('Playing default channel: dunya-news');
            this.playChannel('dunya-news');
        } else {
            // Fallback to first available channel if Dunya News not available
            const activeChannels = ChannelManager.getActiveChannels();
            if (activeChannels.length > 0) {
                console.log('Playing first active channel:', activeChannels[0].id);
                this.playChannel(activeChannels[0].id);
            }
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
