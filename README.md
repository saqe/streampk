# StreamPK - Live Pakistani TV Streaming

A modern, responsive web application for watching live Pakistani TV streams. Built with vanilla JavaScript and JW Player.

![Dark Theme](https://img.shields.io/badge/Theme-Dark%20%2F%20Light-blue)
![No Build](https://img.shields.io/badge/Build-None%20Required-green)

## Features

- **JW Player Integration** - Smooth HLS stream playback with iframe fallback
- **M3U8 Playlist Support** - Load channels from standard M3U8 playlist files
- **Category Filtering** - Organize channels by News, Sports, Entertainment, Religious
- **Favorites** - Save your favorite channels (persisted in localStorage)
- **Dark/Light Theme** - Toggle between themes with persistence
- **Keyboard Navigation** - Full keyboard support for accessibility
- **Deep Linking** - Share direct links to specific channels via URL parameters
- **Responsive Design** - Works on desktop, tablet, and mobile
- **No Build Step** - Pure HTML, CSS, and JavaScript

## Quick Start

1. Clone the repository
2. Start a local server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open http://localhost:8080 in your browser

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` `↓` `←` `→` | Navigate channels |
| `Enter` | Play selected channel |
| `1-9` | Quick select first 9 channels |
| `F` | Toggle favorite |
| `Space` | Play/Pause |

## Adding Channels

Channels are loaded from `playlist.m3u8` in standard M3U8 format. Add entries like:

```
#EXTINF:-1 tvg-id="unique-id" tvg-name="Channel Name" tvg-logo="https://example.com/logo.png" group-title="News",Channel Name
https://example.com/stream.m3u8
```

### M3U8 Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `tvg-id` | Yes | Unique identifier |
| `tvg-name` | Yes | Display name |
| `group-title` | Yes | Category for filtering (creates tab automatically) |
| `tvg-logo` | No | URL to channel logo image |
| Stream URL | Yes | HLS stream URL (.m3u8) on the next line |

### Current Categories

- **News** - Geo News, Dunya News, ARY News, Express News, BOL News, Hum News, 24 News HD, 92 News HD, Capital TV, GNN News, Abb Takk
- **Entertainment** - Harpal Geo, Geo Kahani, Aaj Entertainment, ARY Zindagi
- **Sports** - PTV Sports, Geo Super
- **Religious** - Madani Channel, Peace TV

### Verifying Streams

Before adding a stream, verify it's accessible:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://example.com/stream.m3u8"
```

A `200` response means the stream is accessible. If you get `403`, the stream may require special headers and won't work due to CORS restrictions.

## Project Structure

```
live-stream/
├── index.html          # Main HTML entry point
├── playlist.m3u8       # Channel playlist in M3U8 format
├── css/
│   └── styles.css      # All styles with CSS variables for theming
├── js/
│   ├── channels.js     # ChannelManager - parses M3U8 and manages channel data
│   ├── favorites.js    # FavoritesManager - favorites persistence
│   ├── player.js       # VideoPlayer - JW Player wrapper with iframe fallback
│   └── app.js          # App - main controller and UI logic
└── README.md           # This file
```

## Architecture

Four singleton JavaScript modules work together:

### ChannelManager (`js/channels.js`)
Parses M3U8 playlist and provides channel data:
- `loadChannels()` - Fetch and parse playlist.m3u8
- `getChannels()` - All channels
- `getCategories()` - Unique categories sorted alphabetically
- `getChannelsByCategory(category)` - Filter by category ('all' returns all)
- `getChannelById(id)` - Find by ID
- `getActiveChannels()` - Channels with valid stream URLs

### FavoritesManager (`js/favorites.js`)
Persists favorites to localStorage:
- `getFavorites()` / `saveFavorites(array)` - Get/set favorite IDs
- `addFavorite(id)` / `removeFavorite(id)` / `toggleFavorite(id)` - Modify favorites
- `isFavorite(id)` - Check status
- `getFavoriteChannels()` - Get full channel objects

### VideoPlayer (`js/player.js`)
JW Player wrapper with iframe fallback:
- `init()` - Initialize and cache DOM elements
- `loadChannel(channel)` - Load and play (HLS or iframe)
- `play()` / `pause()` / `togglePlay()` - Playback controls
- `getCurrentChannel()` - Get active channel
- `showError(message)` - Display error overlay

### App (`js/app.js`)
Main controller handling:
- `init()` - Bootstrap application
- `renderCategoryTabs()` / `selectCategory(category)` - Category filtering
- `renderChannels()` / `playChannel(id)` - Channel display and playback
- `toggleFavorite(id)` / `renderFavorites()` - Favorites management
- `toggleTheme()` - Dark/light mode switching
- `shareChannel()` - Share via Web Share API or clipboard

## URL Parameters

Deep link to a specific channel: `?channel=channel-id`

Example: `http://localhost:8080?channel=geo-tv`

## Technologies

- [JW Player](https://www.jwplayer.com/) - Video playback
- [Font Awesome 6.4.2](https://fontawesome.com/) - Icons
- [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter) - Typography
- CSS Variables - Theming with dark/light mode
- localStorage - Persistence for favorites and theme preference

## localStorage Keys

| Key | Purpose | Format |
|-----|---------|--------|
| `liveStreamTheme` | Theme preference | `'dark'` or `'light'` |
| `liveStreamFavorites` | Favorite channel IDs | JSON array of strings |

## Responsive Breakpoints

| Breakpoint | Changes |
|------------|---------|
| ≤1400px | Sidebar: 420px → 380px |
| ≤1100px | Single column layout, sidebar scrollable |
| ≤768px | Reduced padding, keyboard hints hidden |
| ≤480px | Channel actions stack vertically |

## Troubleshooting

### Stream Not Playing
- **CORS errors**: Most m3u8 streams require specific Referer headers that browsers can't spoof. Consider using an iframe embed instead.
- **403 Forbidden**: Stream may be geo-restricted or require authentication.
- **Mixed content**: Ensure streams use HTTPS if the page is served over HTTPS.

### Logo Not Loading
Images that fail to load automatically fall back to a TV icon via `onerror` handler.

### Testing Streams
Use VLC or ffplay to verify streams work before adding:
```bash
ffplay "https://example.com/stream.m3u8"
```

## License

MIT

---

**StreamPK** - Watch Pakistani TV channels live
