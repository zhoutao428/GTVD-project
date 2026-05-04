require('dotenv').config();
const fs = require('fs');
const path = require('path');

// 引入我们的模块
const DataFetcher = require('./data-fetcher');
const AIAnalyzer = require('./ai-analyzer');

async function main() {
    console.log('[GTVD] Starting hotspot update...');
    
    // 1. 数据采集
    console.log('[GTVD] Fetching data...');
    const fetcher = new DataFetcher();
    let items = await fetcher.fetchAll();
    
    // 如果没有采集到数据，使用模拟数据
    if (items.length === 0) {
        console.log('[GTVD] No data fetched, using mock data for demo...');
        items = [
            { title: 'AI技术最新突破：GPT-5性能提升10倍', platform: 'youtube', heat: 950000, url: 'https://youtube.com/watch?v=demo1', thumbnail: '' },
            { title: 'TikTok热门挑战引爆全网：冰桶挑战2024', platform: 'tiktok', heat: 920000, url: 'https://tiktok.com/@user/video/demo1', thumbnail: '' },
            { title: '2024世界杯精彩瞬间回顾', platform: 'youtube', heat: 910000, url: 'https://youtube.com/watch?v=demo2', thumbnail: '' },
            { title: '全球气候峰会达成重大协议', platform: 'twitter', heat: 880000, url: 'https://twitter.com/status/demo3', thumbnail: '' },
            { title: 'SpaceX火星任务最新进展', platform: 'youtube', heat: 870000, url: 'https://youtube.com/watch?v=demo4', thumbnail: '' },
            { title: '新能源汽车销量创新纪录', platform: 'twitter', heat: 850000, url: 'https://twitter.com/status/demo5', thumbnail: '' },
            { title: '数码产品评测合集', platform: 'instagram', heat: 760000, url: 'https://instagram.com/p/demo6', thumbnail: '' },
            { title: '最新电影票房排行榜', platform: 'youtube', heat: 780000, url: 'https://youtube.com/watch?v=demo7', thumbnail: '' },
            { title: '美食博主探访世界各地', platform: 'tiktok', heat: 800000, url: 'https://tiktok.com/@user/video/demo8', thumbnail: '' },
            { title: '教育改革政策解读', platform: 'twitter', heat: 750000, url: 'https://twitter.com/status/demo9', thumbnail: '' }
        ];
    }
    
    // 保存到文件
    const dataPath = './data-fetcher.json';
    fs.writeFileSync(dataPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`[GTVD] Data saved to ${dataPath}`);
    
    // 2. AI 分析
    console.log('[GTVD] Analyzing with AI...');
    const analyzer = new AIAnalyzer();
    const analyzedTopics = await analyzer.analyzeWithRetry(items);
    
    // 3. 生成前端期望的 manifest 格式
    console.log('[GTVD] Generating manifest...');
    
    // 计算总时长（每个话题约8秒intro 3秒 + 10个话题各8秒 + outro 5秒 = 88秒）
    const totalDuration = 88;
    
    const manifest = {
        generated_at: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        video: {
            url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
            poster: '',
            duration: totalDuration
        },
        total_topics: analyzedTopics.length,
        topics: analyzedTopics.map(t => ({
            rank: t.rank,
            title: t.title,
            category: t.category,
            platform: t.platform || '未知',
            heat_score: t.heat_score,
            thumbnail: t.thumbnail || '',
            url: t.url || '',
            recommendation_voice: t.recommendation || t.reason || ''
        }))
    };
    
    // 4. 保存 manifest
    const frontendManifestPath = path.join(__dirname, '..', 'gtvd-frontend', 'public', 'latest.json');
    fs.mkdirSync(path.dirname(frontendManifestPath), { recursive: true });
    fs.writeFileSync(frontendManifestPath, JSON.stringify(manifest, null, 2));
    
    console.log(`[GTVD] Manifest saved to: ${frontendManifestPath}`);
    console.log('[GTVD] Hotspot update complete!');
}

main().catch(error => {
    console.error('[GTVD] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
});
