/**
 * @fileoverview Main application controller for the live streaming application.
 * Handles UI rendering, event handling, and coordinates between other modules.
 */

/**
 * Escapes text for safe use inside HTML markup and attributes.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

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
     * Channel played when no ?channel= is given
     * @type {string}
     * @constant
     */
    DEFAULT_CHANNEL: 'dunya-news',

    /**
     * Current category filter: 'all', 'favorites' or a category name
     * @type {string}
     */
    currentCategory: 'all',

    /**
     * Current search text (lowercased, trimmed)
     * @type {string}
     */
    query: '',

    /**
     * Index of keyboard-selected row in channelCards (-1 = none)
     * @type {number}
     */
    selectedIndex: -1,

    /**
     * Playable channel rows currently rendered, in DOM order
     * @type {HTMLElement[]}
     */
    channelCards: [],

    /** Digits typed for multi-digit channel numbers (e.g. "1", "2" → CH 12) */
    digitBuffer: '',
    digitTimer: null,
    toastTimer: null,

    /**
     * Cached DOM element references
     * @type {Object}
     */
    elements: {},

    /**
     * Initializes the application.
     * Loads channels, initializes components, and sets up event listeners.
     * @async
     */
    async init() {
        const $ = (id) => document.getElementById(id);
        this.elements = {
            themeToggle: $('themeToggle'),
            themeIcon: $('themeIcon'),
            clockTime: $('clockTime'),
            categoryTabs: $('categoryTabs'),
            channelGrid: $('channelGrid'),
            channelCount: $('channelCount'),
            searchInput: $('searchInput'),
            channelName: $('currentChannelName'),
            channelNumber: $('currentChannelNumber'),
            channelCategory: $('currentChannelCategory'),
            channelAvatar: $('channelAvatar'),
            liveBadge: $('liveBadge'),
            favBtn: $('favBtn'),
            prevBtn: $('prevBtn'),
            nextBtn: $('nextBtn'),
            shareBtn: $('shareBtn'),
            retryBtn: $('retryBtn'),
            skipBtn: $('skipBtn'),
            toast: $('toast'),
            moreRow: $('moreRow'),
            moreTitle: $('moreTitle'),
            moreGrid: $('moreGrid'),
            stage: document.querySelector('.stage')
        };

        this.syncThemeUI(document.documentElement.getAttribute('data-theme') || 'dark');
        this.startClock();
        this.renderNowPlaying(null);

        // Load channels from playlist.m3u8
        await ChannelManager.loadChannels();

        VideoPlayer.init();
        this.renderCategoryTabs();
        this.renderChannels();
        this.renderCount();
        this.setupEventListeners();
        this.trackStageHeight();

        // Auto-play channel from URL, or the default one
        this.autoPlayFirstChannel();

        console.log(`StreamPK loaded. ${ChannelManager.getActiveChannelCount()}/${ChannelManager.getChannelCount()} channels available.`);
    },

    /**
     * Sets up global event listeners.
     * @private
     */
    setupEventListeners() {
        const el = this.elements;

        el.themeToggle.addEventListener('click', () => this.toggleTheme());
        el.shareBtn.addEventListener('click', () => this.shareChannel());
        el.favBtn.addEventListener('click', () => this.toggleCurrentFavorite());
        el.prevBtn.addEventListener('click', () => this.stepChannel(-1));
        el.nextBtn.addEventListener('click', () => this.stepChannel(1));
        el.skipBtn.addEventListener('click', () => this.stepChannel(1));
        el.retryBtn.addEventListener('click', () => VideoPlayer.retry());
        el.moreGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.more-card');
            if (card) {
                this.playChannel(card.dataset.channelId);
                this.scrollRowIntoView(card.dataset.channelId);
            }
        });

        el.searchInput.addEventListener('input', () => {
            this.query = el.searchInput.value.trim().toLowerCase();
            this.renderChannels();
        });

        // Category chips (event delegation)
        el.categoryTabs.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (chip) this.selectCategory(chip.dataset.category);
        });

        // Channel rows (event delegation)
        el.channelGrid.addEventListener('click', (e) => {
            const fav = e.target.closest('.ch-fav');
            if (fav) {
                this.toggleFavorite(fav.dataset.channelId);
                return;
            }
            const play = e.target.closest('.ch-play');
            if (play && !play.disabled) this.playChannel(play.dataset.channelId);

            const reset = e.target.closest('[data-action="reset"]');
            if (reset) this.resetFilters();
        });

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    },

    /* ------------------------------------------------------------------ */
    /* Theme & clock                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Toggles between dark and light themes.
     * Persists preference to localStorage.
     */
    toggleTheme() {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        try { localStorage.setItem(this.THEME_KEY, newTheme); } catch (e) { /* storage blocked */ }
        this.syncThemeUI(newTheme);
    },

    /**
     * Updates the theme button and browser chrome color for a theme.
     * @param {string} theme - 'dark' or 'light'
     * @private
     */
    syncThemeUI(theme) {
        const isDark = theme === 'dark';
        this.elements.themeIcon.setAttribute('href', isDark ? '#i-sun' : '#i-moon');
        this.elements.themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
        this.elements.themeToggle.title = `Switch to ${isDark ? 'light' : 'dark'} theme`;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#0a0c0b' : '#f3f4f0');
    },

    /**
     * Shows the current time in Pakistan in the top bar.
     * @private
     */
    startClock() {
        let format;
        try {
            format = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit', hour12: true });
        } catch (e) {
            this.elements.clockTime.parentElement.hidden = true;
            return;
        }
        const tick = () => { this.elements.clockTime.textContent = format.format(new Date()); };
        tick();
        setInterval(tick, 15000);
    },

    /**
     * On narrow screens the player sticks to the top; expose its height so the
     * guide's search bar can stick right below it.
     * @private
     */
    trackStageHeight() {
        if (!('ResizeObserver' in window)) return;
        const narrow = window.matchMedia('(max-width: 1024px)');
        const update = () => {
            const h = narrow.matches ? this.elements.stage.offsetHeight : 0;
            document.documentElement.style.setProperty('--stage-h', `${h}px`);
        };
        new ResizeObserver(update).observe(this.elements.stage);
        narrow.addEventListener?.('change', update);
        update();
    },

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Builds a logo tile. Falls back to a coloured monogram when there is no
     * logo or the image fails to load.
     * @param {Channel} channel
     * @param {string} className - Extra classes for sizing
     * @returns {string} HTML
     */
    logoHtml(channel, className) {
        const initials = channel.name
            .split(/\s+/)
            .filter(w => /[a-z0-9]/i.test(w) && !/^(tv|hd)$/i.test(w))
            .slice(0, 2)
            .map(w => w[0].toUpperCase())
            .join('') || channel.name.slice(0, 2).toUpperCase();

        let hash = 0;
        for (const c of channel.id) hash = (hash * 31 + c.charCodeAt(0)) % 360;
        const style = `--mono-bg: hsl(${hash} 42% 32%)`;
        const mono = `<span class="monogram">${escapeHtml(initials)}</span>`;

        if (!channel.logo) {
            return `<span class="logo-tile is-fallback ${className}" style="${style}">${mono}</span>`;
        }
        return `<span class="logo-tile ${className}" style="${style}">` +
            `<img src="${escapeHtml(channel.logo)}" alt="" loading="lazy" decoding="async" ` +
            `onerror="this.parentElement.classList.add('is-fallback');this.remove()">${mono}</span>`;
    },

    /**
     * Shows the number of playable channels in the guide header.
     * @private
     */
    renderCount() {
        const live = ChannelManager.getActiveChannelCount();
        const total = ChannelManager.getChannelCount();
        this.elements.channelCount.innerHTML = `<b>${live}</b> live · ${total} total`;
    },

    /**
     * Renders category chips with counts. Adds a Favorites chip when there are any.
     */
    renderCategoryTabs() {
        const all = ChannelManager.getChannels();
        const favCount = FavoritesManager.getFavoriteChannels().length;

        if (this.currentCategory === 'favorites' && favCount === 0) {
            this.currentCategory = 'all';
        }

        const chip = (key, label, count, icon = '') => `
            <button class="chip" type="button" data-category="${escapeHtml(key)}"
                    aria-pressed="${this.currentCategory === key}">
                ${icon}${escapeHtml(label)}<span class="chip-count">${count}</span>
            </button>`;

        const chips = [chip('all', 'All', all.length)];
        if (favCount > 0) {
            chips.push(chip('favorites', 'Favorites', favCount, '<svg class="icon"><use href="#i-star"/></svg>'));
        }
        ChannelManager.getCategories().forEach(cat => {
            chips.push(chip(cat, cat, ChannelManager.getChannelsByCategory(cat).length));
        });

        this.elements.categoryTabs.innerHTML = chips.join('');
    },

    /**
     * Selects a category and updates the UI.
     * @param {string} category - 'all', 'favorites' or a category name
     */
    selectCategory(category) {
        this.currentCategory = category;
        this.elements.categoryTabs.querySelectorAll('.chip').forEach(chip => {
            chip.setAttribute('aria-pressed', String(chip.dataset.category === category));
        });
        this.renderChannels();
        this.elements.channelGrid.scrollTop = 0;
    },

    /**
     * Clears search and category filters.
     * @private
     */
    resetFilters() {
        this.elements.searchInput.value = '';
        this.query = '';
        this.selectCategory('all');
    },

    /**
     * Renders a single channel row.
     * @param {Channel} channel
     * @param {Channel|null} current - Currently playing channel
     * @returns {string} HTML
     * @private
     */
    rowHtml(channel, current) {
        const playable = ChannelManager.isPlayable(channel);
        const isPlaying = current && current.id === channel.id;
        const isFav = FavoritesManager.isFavorite(channel.id);
        const id = escapeHtml(channel.id);
        const name = escapeHtml(channel.name);
        const num = channel.number ? String(channel.number).padStart(2, '0') : '–';

        return `
            <div class="ch-row${isPlaying ? ' is-playing' : ''}${playable ? '' : ' is-offline'}"
                 role="listitem" data-channel-id="${id}">
                <button class="ch-play" type="button" data-channel-id="${id}"
                        ${playable ? `aria-label="Watch ${name}, channel ${channel.number}"` : 'disabled aria-disabled="true"'}
                        ${isPlaying ? 'aria-current="true"' : ''}>
                    <span class="ch-num">${num}</span>
                    ${this.logoHtml(channel, 'ch-logo')}
                    <span class="ch-text">
                        <span class="ch-name">${name}</span>
                        <span class="ch-sub">${playable ? escapeHtml(channel.category) : '<span class="offline-tag">Offline</span>' + escapeHtml(channel.category)}</span>
                    </span>
                    <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
                </button>
                <button class="ch-fav" type="button" data-channel-id="${id}"
                        aria-pressed="${isFav}" aria-label="${isFav ? 'Remove' : 'Add'} ${name} ${isFav ? 'from' : 'to'} favorites">
                    <svg class="icon"><use href="#${isFav ? 'i-star' : 'i-star-line'}"/></svg>
                </button>
            </div>`;
    },

    /**
     * Renders the channel guide for the current category and search query.
     */
    renderChannels() {
        const current = VideoPlayer.getCurrentChannel();
        const q = this.query;

        let base;
        if (this.currentCategory === 'all') base = ChannelManager.getChannels();
        else if (this.currentCategory === 'favorites') base = FavoritesManager.getFavoriteChannels();
        else base = ChannelManager.getChannelsByCategory(this.currentCategory);

        const matches = (ch) => !q ||
            ch.name.toLowerCase().includes(q) ||
            (ch.category || '').toLowerCase().includes(q) ||
            (ch.number && String(ch.number) === q.replace(/^0+/, ''));

        const list = base.filter(matches);

        // Build groups: [{ label, icon, channels }]
        const groups = [];
        const playable = list.filter(ch => ChannelManager.isPlayable(ch));
        const offline = list.filter(ch => !ChannelManager.isPlayable(ch));

        if (this.currentCategory === 'all' && !q) {
            const favs = FavoritesManager.getFavoriteChannels();
            if (favs.length) groups.push({ label: 'Favorites', star: true, channels: favs });
            ChannelManager.getCategories().forEach(cat => {
                const inCat = playable.filter(ch => ch.category === cat);
                if (inCat.length) groups.push({ label: cat, channels: inCat });
            });
        } else {
            groups.push({ label: null, channels: playable });
        }
        if (offline.length) groups.push({ label: 'Offline', channels: offline });

        if (list.length === 0) {
            const message = q
                ? `No channels match “${escapeHtml(this.elements.searchInput.value.trim())}”`
                : 'No channels here yet';
            this.elements.channelGrid.innerHTML = `
                <div class="empty">
                    <svg class="icon"><use href="#i-tv"/></svg>
                    <p>${message}</p>
                    ${q || this.currentCategory !== 'all' ? '<button type="button" data-action="reset">Show all channels</button>' : ''}
                </div>`;
            this.channelCards = [];
            this.selectedIndex = -1;
            return;
        }

        this.elements.channelGrid.innerHTML = groups.map(group => `
            ${group.label ? `<div class="group-label" role="presentation">${group.star ? '<svg class="icon"><use href="#i-star"/></svg>' : ''}${escapeHtml(group.label)}</div>` : ''}
            ${group.channels.map(ch => this.rowHtml(ch, current)).join('')}
        `).join('');

        this.channelCards = Array.from(this.elements.channelGrid.querySelectorAll('.ch-row:not(.is-offline)'));
        this.selectedIndex = -1;
    },

    /**
     * Updates the now-playing bar for a channel (or the empty state).
     * @param {Channel|null} channel
     * @private
     */
    renderNowPlaying(channel) {
        const el = this.elements;

        if (!channel) {
            el.channelName.textContent = 'StreamPK';
            el.channelNumber.textContent = '';
            el.channelCategory.textContent = 'No channel selected';
            el.liveBadge.hidden = true;
            el.channelAvatar.className = 'now-logo logo-tile is-empty';
            el.channelAvatar.innerHTML = '<svg class="icon"><use href="#i-tv"/></svg>';
            el.favBtn.disabled = true;
            el.shareBtn.disabled = true;
            return;
        }

        el.channelName.textContent = channel.name;
        el.channelNumber.textContent = channel.number ? `CH ${String(channel.number).padStart(2, '0')}` : '';
        el.channelCategory.textContent = channel.category;
        el.liveBadge.hidden = false;
        el.favBtn.disabled = false;
        el.shareBtn.disabled = false;

        const tmp = document.createElement('div');
        tmp.innerHTML = this.logoHtml(channel, 'now-logo');
        const logo = tmp.firstElementChild;
        logo.id = 'channelAvatar';
        el.channelAvatar.replaceWith(logo);
        el.channelAvatar = logo;
        el.channelAvatar.setAttribute('aria-hidden', 'true');

        this.renderFavButton();
        this.renderMore(channel);
        document.title = `${channel.name} · StreamPK`;
    },

    /**
     * Shows a quick-switch strip of other channels from the same category
     * (topped up with other channels if the category is small).
     * @param {Channel} channel - Currently playing channel
     * @private
     */
    renderMore(channel) {
        const LIMIT = 6;
        const others = ChannelManager.getActiveChannels().filter(ch => ch.id !== channel.id);
        const same = others.filter(ch => ch.category === channel.category);
        const picks = [...same, ...others.filter(ch => ch.category !== channel.category)].slice(0, LIMIT);

        if (picks.length === 0) {
            this.elements.moreRow.hidden = true;
            return;
        }

        this.elements.moreTitle.textContent = same.length >= 3 ? `More in ${channel.category}` : 'More channels';
        this.elements.moreGrid.innerHTML = picks.map(ch => `
            <button class="more-card" type="button" data-channel-id="${escapeHtml(ch.id)}">
                ${this.logoHtml(ch, '')}
                <span class="ch-text">
                    <span class="ch-name">${escapeHtml(ch.name)}</span>
                    <span class="ch-sub">CH ${String(ch.number).padStart(2, '0')}</span>
                </span>
            </button>`).join('');
        this.elements.moreRow.hidden = false;
    },

    /**
     * Syncs the now-playing star button with the current channel's favorite state.
     * @private
     */
    renderFavButton() {
        const channel = VideoPlayer.getCurrentChannel();
        const isFav = channel ? FavoritesManager.isFavorite(channel.id) : false;
        this.elements.favBtn.setAttribute('aria-pressed', String(isFav));
        this.elements.favBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
        this.elements.favBtn.querySelector('use').setAttribute('href', isFav ? '#i-star' : '#i-star-line');
    },

    /* ------------------------------------------------------------------ */
    /* Actions                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Plays a channel and updates the URL and UI.
     * @param {string} channelId
     */
    playChannel(channelId) {
        const channel = ChannelManager.getChannelById(channelId);
        if (!channel) return;

        if (!ChannelManager.isPlayable(channel)) {
            this.showToast(`${channel.name} is offline right now`);
            return;
        }

        VideoPlayer.loadChannel(channel);
        this.renderNowPlaying(channel);

        // Update browser URL with channel parameter
        const url = new URL(window.location);
        url.searchParams.set('channel', channelId);
        history.replaceState(null, '', url);

        // Update playing state in the guide
        this.elements.channelGrid.querySelectorAll('.ch-row').forEach(row => {
            const playing = row.dataset.channelId === channelId;
            row.classList.toggle('is-playing', playing);
            const btn = row.querySelector('.ch-play');
            if (playing) btn.setAttribute('aria-current', 'true');
            else btn.removeAttribute('aria-current');
        });

        const cardIndex = this.channelCards.findIndex(row => row.dataset.channelId === channelId);
        if (cardIndex !== -1) this.selectedIndex = cardIndex;
    },

    /**
     * Plays the next (+1) or previous (-1) playable channel.
     * @param {number} step
     */
    stepChannel(step) {
        const current = VideoPlayer.getCurrentChannel();
        const next = ChannelManager.getAdjacentChannel(current ? current.id : null, step);
        if (next) {
            this.playChannel(next.id);
            this.scrollRowIntoView(next.id);
        }
    },

    /**
     * Toggles a channel's favorite state and refreshes the UI.
     * @param {string} channelId
     */
    toggleFavorite(channelId) {
        const channel = ChannelManager.getChannelById(channelId);
        const isFavorite = FavoritesManager.toggleFavorite(channelId);

        const scroll = this.elements.channelGrid.scrollTop;
        this.renderCategoryTabs();
        this.renderChannels();
        this.elements.channelGrid.scrollTop = scroll;
        this.renderFavButton();

        if (channel) {
            this.showToast(isFavorite ? `Added ${channel.name} to favorites` : `Removed ${channel.name} from favorites`);
        }
    },

    /**
     * Toggles favorite for the playing channel, or the keyboard-selected one.
     */
    toggleCurrentFavorite() {
        const current = VideoPlayer.getCurrentChannel();
        let channelId = current ? current.id : null;
        if (!channelId && this.selectedIndex >= 0 && this.channelCards[this.selectedIndex]) {
            channelId = this.channelCards[this.selectedIndex].dataset.channelId;
        }
        if (channelId) this.toggleFavorite(channelId);
    },

    /**
     * Shares the currently playing channel via Web Share API or clipboard.
     * Generates a deep link URL with the channel ID parameter.
     */
    async shareChannel() {
        const channel = VideoPlayer.getCurrentChannel();
        if (!channel) {
            this.showToast('Pick a channel first');
            return;
        }

        const shareUrl = `${window.location.origin}${window.location.pathname}?channel=${encodeURIComponent(channel.id)}`;

        if (navigator.share) {
            try {
                await navigator.share({ title: `${channel.name} · StreamPK`, url: shareUrl });
            } catch (e) { /* user cancelled */ }
            return;
        }

        if (await this.copyToClipboard(shareUrl)) {
            this.showToast('Link copied to clipboard');
        } else {
            prompt('Copy this link:', shareUrl);
        }
    },

    /**
     * Copies text to the clipboard.
     * @param {string} text
     * @returns {Promise<boolean>} Whether the copy succeeded
     * @private
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) { /* fall through to legacy copy */ }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(textarea);
        return ok;
    },

    /**
     * Shows a short message at the bottom of the screen.
     * @param {string} message
     */
    showToast(message) {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.classList.add('is-visible');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
    },

    /* ------------------------------------------------------------------ */
    /* Keyboard                                                            */
    /* ------------------------------------------------------------------ */

    /**
     * Handles global keyboard shortcuts.
     * @param {KeyboardEvent} e
     * @private
     */
    handleKeyboard(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const target = e.target;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        if (isTyping) {
            if (e.key === 'Escape' && target === this.elements.searchInput) {
                if (target.value) {
                    target.value = '';
                    this.query = '';
                    this.renderChannels();
                } else {
                    target.blur();
                }
            } else if (e.key === 'ArrowDown' && target === this.elements.searchInput && this.channelCards.length) {
                e.preventDefault();
                target.blur();
                this.navigateChannels(1);
            } else if (e.key === 'Enter' && target === this.elements.searchInput && this.channelCards.length) {
                this.playChannel(this.channelCards[0].dataset.channelId);
            }
            return;
        }

        const onButton = target.tagName === 'BUTTON' || target.tagName === 'A';

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.navigateChannels(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.navigateChannels(1);
                break;
            case 'Enter':
                if (onButton) return; // let the focused button handle it
                if (this.selectedIndex >= 0 && this.channelCards[this.selectedIndex]) {
                    e.preventDefault();
                    this.playChannel(this.channelCards[this.selectedIndex].dataset.channelId);
                }
                break;
            case '[':
                this.stepChannel(-1);
                break;
            case ']':
                this.stepChannel(1);
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.toggleCurrentFavorite();
                break;
            case '/':
                e.preventDefault();
                this.elements.searchInput.focus();
                this.elements.searchInput.select();
                break;
            case ' ':
                if (onButton) return;
                e.preventDefault();
                VideoPlayer.togglePlay();
                break;
            default:
                if (/^[0-9]$/.test(e.key)) {
                    e.preventDefault();
                    this.handleDigit(e.key);
                }
                break;
        }
    },

    /**
     * TV-remote style channel entry: type "7" for CH 7, or "1" then "2" for CH 12.
     * @param {string} digit
     * @private
     */
    handleDigit(digit) {
        clearTimeout(this.digitTimer);
        this.digitBuffer = (this.digitBuffer + digit).slice(-2);

        const max = ChannelManager.getActiveChannelCount();
        const typed = parseInt(this.digitBuffer, 10);

        const commit = () => {
            const n = parseInt(this.digitBuffer, 10);
            this.digitBuffer = '';
            const channel = ChannelManager.getChannelByNumber(n);
            if (channel) {
                this.playChannel(channel.id);
                this.scrollRowIntoView(channel.id);
            } else {
                this.showToast(`No channel ${n}`);
            }
        };

        // Wait for a second digit only if one could still form a valid number
        if (this.digitBuffer.length === 1 && typed * 10 <= max) {
            this.showToast(`Channel ${this.digitBuffer}_`);
            this.digitTimer = setTimeout(commit, 900);
        } else {
            commit();
        }
    },

    /**
     * Moves the keyboard cursor through playable rows.
     * @param {number} direction - +1 or -1
     */
    navigateChannels(direction) {
        const total = this.channelCards.length;
        if (total === 0) return;

        if (this.selectedIndex === -1) {
            const playingIndex = this.channelCards.findIndex(r => r.classList.contains('is-playing'));
            this.selectedIndex = playingIndex !== -1
                ? (playingIndex + direction + total) % total
                : (direction === 1 ? 0 : total - 1);
        } else {
            this.selectedIndex = (this.selectedIndex + direction + total) % total;
        }

        this.channelCards.forEach((row, i) => row.classList.toggle('is-selected', i === this.selectedIndex));
        this.channelCards[this.selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    /**
     * Scrolls the guide so a channel's row is visible.
     * @param {string} channelId
     * @private
     */
    scrollRowIntoView(channelId) {
        const row = this.channelCards.find(r => r.dataset.channelId === channelId);
        if (row && window.matchMedia('(min-width: 1025px)').matches) {
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    },

    /**
     * Plays the channel from ?channel=, else the default, else the first playable one.
     * @private
     */
    autoPlayFirstChannel() {
        const urlParams = new URLSearchParams(window.location.search);
        const fromUrl = ChannelManager.getChannelById(urlParams.get('channel'));
        if (fromUrl && ChannelManager.isPlayable(fromUrl)) {
            this.playChannel(fromUrl.id);
            this.scrollRowIntoView(fromUrl.id);
            return;
        }

        const fallback = ChannelManager.getChannelById(this.DEFAULT_CHANNEL);
        if (fallback && ChannelManager.isPlayable(fallback)) {
            this.playChannel(fallback.id);
            return;
        }

        const first = ChannelManager.getActiveChannels()[0];
        if (first) this.playChannel(first.id);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
