require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class DataFetcher {
    constructor() {
        this.retryCount = 3;
        this.retryDelay = 1000;
        this.timeout = 30000;

        this.proxyHost = process.env.BRIGHTDATA_PROXY_HOST;
        this.proxyPort = process.env.BRIGHTDATA_PROXY_PORT;
        this.proxyUsername = process.env.BRIGHTDATA_PROXY_USERNAME;
        this.proxyPassword = process.env.BRIGHTDATA_PROXY_PASSWORD;

        this.proxy = this.buildProxy();

        console.log('[DataFetcher] BrightData Proxy:', this.proxyHost ? 'configured' : 'NOT configured');
    }

    buildProxy() {
        if (!this.proxyHost || !this.proxyUsername || !this.proxyPassword) {
            return null;
        }
        return `http://${this.proxyUsername}:${this.proxyPassword}@${this.proxyHost}:${this.proxyPort}`;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchWithRetry(url, options = {}, sourceName) {
        let lastError;
        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                const config = {
                    ...options,
                    timeout: this.timeout,
                    proxy: this.proxy ? { host: this.proxyHost, port: this.proxyPort, auth: { username: this.proxyUsername, password: this.proxyPassword } } : undefined
                };

                const response = await axios(url, config);
                return response.data;
            } catch (error) {
                lastError = error;
                if (attempt < this.retryCount) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`[DataFetcher] ${sourceName} attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }
        console.error(`[DataFetcher] ${sourceName} failed after ${this.retryCount} attempts: ${lastError.message}`);
        return null;
    }

    async fetchYouTubeTrending() {
        console.log('[DataFetcher] Fetching YouTube trending...');
        
        try {
            const url = 'https://www.youtube.com/feed/trending';
            const data = await this.fetchWithRetry(url, { method: 'GET' }, 'YouTube');
            
            if (!data) return [];

            const videos = [];
            const regex = /"videoRenderer":\{[^}]*"title":\{[^}]*"simpleText":"([^"]+)"[^}]*"videoId":"([^"]+)"[^}]*"viewCountText":\{[^}]*"simpleText":"([^"]+)"[^}]*}/g;
            let match;

            while ((match = regex.exec(data)) !== null) {
                const title = match[1];
                const videoId = match[2];
                const views = match[3].replace(/[^0-9]/g, '');

                videos.push({
                    title: title,
                    platform: 'youtube',
                    heat: parseInt(views) || 0,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                });

                if (videos.length >= 15) break;
            }

            console.log(`[DataFetcher] YouTube fetched ${videos.length} videos`);
            return videos;
        } catch (error) {
            console.error(`[DataFetcher] YouTube fetch error: ${error.message}`);
            return [];
        }
    }

    async fetchTikTokTrending() {
        console.log('[DataFetcher] Fetching TikTok trending...');

        try {
            const url = 'https://www.tiktok.com/api/discover/item_list/?count=15';
            const data = await this.fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 'TikTok');

            if (!data || !data.body) return [];

            const items = data.body.items || [];
            const videos = items.map(item => ({
                title: item.desc || item.text || 'TikTok Video',
                platform: 'tiktok',
                heat: item.stats?.playCount || item.viewCount || 0,
                url: `https://www.tiktok.com/@${item.author?.uniqueId || ''}/video/${item.id}`,
                thumbnail: item.cover?.url || item.video?.cover || ''
            })).filter(v => v.title && v.url);

            console.log(`[DataFetcher] TikTok fetched ${videos.length} videos`);
            return videos.slice(0, 15);
        } catch (error) {
            console.error(`[DataFetcher] TikTok fetch error: ${error.message}`);
            return [];
        }
    }

    async fetchTwitterTrending() {
        console.log('[DataFetcher] Fetching Twitter trending...');

        try {
            const url = 'https://api.twitter.com/1.1/trends/place.json?id=1';
            const data = await this.fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
                }
            }, 'Twitter');

            if (!data || !data[0]?.trends) return [];

            const trends = data[0].trends.slice(0, 15).map(item => ({
                title: item.name,
                platform: 'twitter',
                heat: item.tweet_volume || 0,
                url: `https://twitter.com/search?q=${encodeURIComponent(item.name)}`,
                thumbnail: ''
            }));

            console.log(`[DataFetcher] Twitter fetched ${trends.length} trends`);
            return trends;
        } catch (error) {
            console.error(`[DataFetcher] Twitter fetch error: ${error.message}`);
            return [];
        }
    }

    async fetchInstagramTrending() {
        console.log('[DataFetcher] Fetching Instagram trending...');

        try {
            const url = 'https://www.instagram.com/explore/tags/trending/';
            const data = await this.fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, 'Instagram');

            if (!data) return [];

            const posts = [];
            const regex = /"edge_media_to_caption":\{[^}]*"edges":\[{[^}]*"node":\{[^}]*"text":"([^"]+)"[^}]*}\][^}]*}[^}]*"display_url":"([^"]+)"[^}]*"likes":\{[^}]*"count":(\d+)/g;
            let match;

            while ((match = regex.exec(data)) !== null) {
                posts.push({
                    title: match[1].substring(0, 200),
                    platform: 'instagram',
                    heat: parseInt(match[3]) || 0,
                    url: '',
                    thumbnail: match[2]
                });

                if (posts.length >= 10) break;
            }

            console.log(`[DataFetcher] Instagram fetched ${posts.length} posts`);
            return posts;
        } catch (error) {
            console.error(`[DataFetcher] Instagram fetch error: ${error.message}`);
            return [];
        }
    }

    deduplicate(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = item.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
            if (seen.has(key) || !item.title) return false;
            seen.add(key);
            return true;
        });
    }

    async fetchAll() {
        console.log('[DataFetcher] Starting data collection...');

        const [youtube, tiktok, twitter, instagram] = await Promise.all([
            this.fetchYouTubeTrending(),
            this.fetchTikTokTrending(),
            this.fetchTwitterTrending(),
            this.fetchInstagramTrending()
        ]);

        const allItems = [...youtube, ...tiktok, ...twitter, ...instagram];
        const uniqueItems = this.deduplicate(allItems);

        console.log(`[DataFetcher] Total: ${allItems.length}, Unique: ${uniqueItems.length}`);

        return uniqueItems;
    }

    async saveToFile(items, filename = 'data-fetcher.json') {
        const json = JSON.stringify(items, null, 2);
        fs.writeFileSync(filename, json, 'utf-8');
        console.log(`[DataFetcher] Saved to ${filename}`);
        return filename;
    }
}

async function main() {
    const fetcher = new DataFetcher();
    const items = await fetcher.fetchAll();
    await fetcher.saveToFile(items);
    return items;
}

if (require.main === module) {
    main().catch(error => {
        console.error('[DataFetcher] Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = DataFetcher;
