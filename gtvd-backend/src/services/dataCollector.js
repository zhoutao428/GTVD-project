const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');

class DataCollector {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.today = new Date().toISOString().split('T')[0];
    }

    async fetchFromKeyAPI(category = 'hot') {
        try {
            const response = await axios.get('https://api.keyapi.cn/v1/hot/list', {
                params: {
                    appkey: process.env.KEYAPI_KEY,
                    category: category,
                    num: 20
                },
                timeout: 10000
            });

            if (response.data.code === 200 && response.data.data) {
                return response.data.data.map(item => ({
                    id: uuidv4(),
                    title: item.title || item.word,
                    summary: item.desc || item.description || '',
                    source: item.source || 'KeyAPI',
                    source_url: item.url || '',
                    category: category,
                    tags: item.tags || '',
                    heatIndex: item.hot_value || item指数 || 0,
                    pub_date: item.publish_time || this.today,
                    collect_date: this.today
                }));
            }
            return [];
        } catch (error) {
            this.logger('error', 'DataCollector', `KeyAPI fetch failed: ${error.message}`);
            return [];
        }
    }

    async fetchFromJuheAPI(category = 'top') {
        try {
            const endpoint = category === 'ai' 
                ? 'http://apis.juhe.cn/ai_news/list' 
                : 'http://apis.juhe.cn/toutiao/index';

            const response = await axios.get(endpoint, {
                params: {
                    key: process.env.JUHE_API_KEY,
                    type: category,
                    page: 1,
                    page_size: 20
                },
                timeout: 10000
            });

            if (response.data.error_code === 0 && response.data.result) {
                const items = response.data.result.data || response.data.result.list || [];
                return items.map(item => ({
                    id: uuidv4(),
                    title: item.title || item.word,
                    summary: item.desc || item.description || '',
                    source: item.source || 'JuheAPI',
                    source_url: item.url || '',
                    category: category,
                    tags: item.tags || '',
                    heatIndex: item.hot_value || item.热度 || 0,
                    pub_date: item.ctime || item.publish_time || this.today,
                    collect_date: this.today
                }));
            }
            return [];
        } catch (error) {
            this.logger('error', 'DataCollector', `JuheAPI fetch failed: ${error.message}`);
            return [];
        }
    }

    async fetchFromAlternativeSources() {
        const sources = [];
        
        try {
            const response = await axios.get('https://top.baidu.com/board?tab=realtime', {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const $ = cheerio.load(response.data);
            $('.item-wrap, .list-item, .topic-item').each((i, el) => {
                if (i >= 10) return false;
                const title = $(el).find('.title, .topic-title, h3').text().trim();
                const desc = $(el).find('.desc, .abstract, .topic-desc').text().trim();
                const hot = $(el).find('.hot-index, .heat, .index').text().trim();
                
                if (title) {
                    sources.push({
                        id: uuidv4(),
                        title: title,
                        summary: desc,
                        source: 'BaiduHot',
                        source_url: '',
                        category: 'hot',
                        tags: '',
                        heatIndex: parseInt(hot.replace(/[^0-9]/g, '')) || 0,
                        pub_date: this.today,
                        collect_date: this.today
                    });
                }
            });
        } catch (error) {
            this.logger('warn', 'DataCollector', `Baidu hot search fetch failed: ${error.message}`);
        }

        try {
            const response = await axios.get('https://weibo.com/ajax/side/hotSearch', {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data.data && response.data.data.realtime) {
                response.data.data.realtime.slice(0, 10).forEach(item => {
                    sources.push({
                        id: uuidv4(),
                        title: item.word || item.topic,
                        summary: item.raw_hot || item.desc || '',
                        source: 'WeiboHot',
                        source_url: `https://s.weibo.com/weibo?q=${encodeURIComponent(item.word || item.topic)}`,
                        category: 'hot',
                        tags: item.label_name || '',
                        heatIndex: item.raw_hot || item指数 || 0,
                        pub_date: this.today,
                        collect_date: this.today
                    });
                });
            }
        } catch (error) {
            this.logger('warn', 'DataCollector', `Weibo hot search fetch failed: ${error.message}`);
        }

        return sources;
    }

    async collect() {
        this.logger('info', 'DataCollector', 'Starting daily data collection');
        const allTopics = [];

        const keyapiResults = await this.fetchFromKeyAPI('hot');
        allTopics.push(...keyapiResults);
        this.logger('info', 'DataCollector', `KeyAPI fetched ${keyapiResults.length} topics`);

        const juheResults = await this.fetchFromJuheAPI('top');
        allTopics.push(...juheResults);
        this.logger('info', 'DataCollector', `JuheAPI fetched ${juheResults.length} topics`);

        const aiResults = await this.fetchFromJuheAPI('ai');
        const filteredAI = aiResults.filter(item => 
            item.title.toLowerCase().includes('ai') || 
            item.title.toLowerCase().includes('人工智能') ||
            item.title.toLowerCase().includes('gpt') ||
            item.title.toLowerCase().includes('大模型')
        );
        allTopics.push(...filteredAI);
        this.logger('info', 'DataCollector', `AI topics filtered: ${filteredAI.length} from ${aiResults.length}`);

        const altResults = await this.fetchFromAlternativeSources();
        allTopics.push(...altResults);
        this.logger('info', 'DataCollector', `Alternative sources fetched ${altResults.length} topics`);

        const uniqueTopics = this.deduplicateTopics(allTopics);
        
        let savedCount = 0;
        for (const topic of uniqueTopics) {
            try {
                this.db.insertHotTopic(topic);
                savedCount++;
            } catch (error) {
                if (!error.message.includes('UNIQUE constraint')) {
                    this.logger('error', 'DataCollector', `Failed to save topic: ${error.message}`);
                }
            }
        }

        this.logger('info', 'DataCollector', `Collection complete. Total: ${allTopics.length}, Unique: ${uniqueTopics.length}, Saved: ${savedCount}`);
        return { total: allTopics.length, unique: uniqueTopics.length, saved: savedCount };
    }

    deduplicateTopics(topics) {
        const seen = new Set();
        return topics.filter(topic => {
            const key = topic.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
}

module.exports = DataCollector;
