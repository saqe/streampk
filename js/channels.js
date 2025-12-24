// Channel data management
const ChannelManager = {
    // Channel data - Add your m3u8 streams here
    channels: [
        // News Channels
        {
            id: 'geo-tv',
            name: 'Geo News',
            category: 'News',
            logo: 'https://i.imgur.com/Op4EsaB.png',
            stream: 'https://jk3lz82elw79-hls-live.5centscdn.com/newgeonews/07811dc6c422334ce36a09ff5cd6fe71.sdp/playlist.m3u8'
        },
        {
            id: 'harpal-geo',
            name: 'Harpal Geo',
            category: 'Entertainment',
            logo: 'https://i.imgur.com/NX3vvAX.png',
            stream: '' // Stream currently down
        },
        {
            id: 'dunya-news',
            name: 'Dunya News',
            category: 'News',
            logo: 'https://i.postimg.cc/htHtP9VP/dunyanews.png',
            stream: 'https://imob.dunyanews.tv/livehd/_definst_/ngrp:dunyalivehd_2_all/playlist.m3u8'
        },
        {
            id: '92-news',
            name: '92 News HD',
            category: 'News',
            logo: 'https://i.imgur.com/gp1Ao4s.jpeg',
            stream: 'http://92news.vdn.dstreamone.net/92newshd/92hd/playlist.m3u8'
        },
        {
            id: 'ary-news',
            name: 'ARY News',
            category: 'News',
            logo: 'https://i.postimg.cc/K85QNzjF/arynews.png',
            stream: 'http://66.102.120.18:8000/play/a02z/index.m3u8'
        },
        {
            id: 'express-news',
            name: 'Express News',
            category: 'News',
            logo: 'https://i.imgur.com/2ugiEOt.png',
            stream: 'http://66.102.120.18:8000/play/a053/index.m3u8'
        },
        {
            id: 'samaa-tv',
            name: 'Samaa TV',
            category: 'News',
            logo: 'https://i.imgur.com/r3U4A1P.png',
            stream: '' // Stream unavailable
        },
        {
            id: 'bol-news',
            name: 'BOL News',
            category: 'News',
            logo: 'https://i.imgur.com/chHLi5u.png',
            stream: 'http://66.102.120.18:8000/play/a038/index.m3u8'
        },
        {
            id: 'hum-news',
            name: 'Hum News',
            category: 'News',
            logo: 'https://i.postimg.cc/FRQc1Y23/humnews.png',
            stream: 'http://66.102.120.18:8000/play/a05e/index.m3u8'
        },
        {
            id: '24-news',
            name: '24 News HD',
            category: 'News',
            logo: 'https://upload.wikimedia.org/wikipedia/en/9/93/24_News_HD_Logo.png',
            stream: '' // Not playing in JW Player
        },

        // Sports Channels
        {
            id: 'ptv-sports',
            name: 'PTV Sports',
            category: 'Sports',
            logo: 'https://i.imgur.com/CPm6GHA.png',
            stream: 'https://tvsen5.aynaott.com/Ptvsports/index.m3u8'
        },
        {
            id: 'geo-super',
            name: 'Geo Super',
            category: 'Sports',
            logo: 'https://upload.wikimedia.org/wikipedia/en/5/5f/Geo_Super_logo.png',
            stream: 'http://66.102.120.18:8000/play/a063/index.m3u8'
        },
        {
            id: 'a-sports',
            name: 'A Sports',
            category: 'Sports',
            logo: 'https://i.imgur.com/cl7vugU.png',
            stream: '' // Stream unavailable
        },

        // Entertainment Channels
        {
            id: 'ary-digital',
            name: 'ARY Digital',
            category: 'Entertainment',
            logo: 'https://i.imgur.com/TVP7g03.png',
            stream: 'http://66.102.120.18:8000/play/a030/index.m3u8'
        },
        {
            id: 'hum-sitaray',
            name: 'Hum Sitaray',
            category: 'Entertainment',
            logo: 'https://i.imgur.com/D0A0eUJ.png',
            stream: 'http://66.102.120.18:8000/play/a05i/index.m3u8'
        },
        {
            id: 'geo-kahani',
            name: 'Geo Kahani',
            category: 'Entertainment',
            logo: 'https://i.postimg.cc/7ZmSsPJy/geokahani.png',
            stream: 'http://66.102.120.18:8000/play/a064/index.m3u8'
        },
        {
            id: 'express-entertainment',
            name: 'Express Entertainment',
            category: 'Entertainment',
            logo: 'https://i.imgur.com/rgHbb8W.png',
            stream: '' // Stream returns 404
        },
        {
            id: 'aaj-entertainment',
            name: 'Aaj Entertainment',
            category: 'Entertainment',
            logo: 'https://i.imgur.com/WK5Cqap.png',
            stream: 'http://66.102.120.18:8000/play/a05b/index.m3u8'
        },

        // Movies Channels
        {
            id: 'ary-zindagi',
            name: 'ARY Zindagi',
            category: 'Movies',
            logo: 'https://i.imgur.com/TVP7g03.png',
            stream: 'http://66.102.120.18:8000/play/a031/index.m3u8'
        },

        // Music Channels
        {
            id: '8xm',
            name: '8XM Music',
            category: 'Music',
            logo: 'https://i.imgur.com/KLrfKRn.png',
            stream: 'http://66.102.120.18:8000/play/a050/index.m3u8'
        },
        {
            id: 'joo-music',
            name: 'Joo Music',
            category: 'Music',
            logo: 'https://i.imgur.com/KHuKQQL.png',
            stream: 'https://livecdn.live247stream.com/joomusic/tv/playlist.m3u8'
        }
    ],

    // Get all channels
    getChannels() {
        return this.channels;
    },

    // Get all unique categories
    getCategories() {
        const categories = [...new Set(this.channels.map(ch => ch.category))];
        return categories.sort();
    },

    // Get channels by category
    getChannelsByCategory(category) {
        if (category === 'all') {
            return this.channels;
        }
        return this.channels.filter(ch => ch.category === category);
    },

    // Get channel by ID
    getChannelById(id) {
        return this.channels.find(ch => ch.id === id);
    },

    // Get channels that have valid streams
    getActiveChannels() {
        return this.channels.filter(ch => ch.stream && ch.stream.length > 0);
    },

    // Get channel count
    getChannelCount() {
        return this.channels.length;
    },

    // Get active channel count
    getActiveChannelCount() {
        return this.getActiveChannels().length;
    }
};
