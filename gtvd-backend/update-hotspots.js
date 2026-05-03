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
    await fetcher.fetchAll();
    
    // 2. AI 分析
    console.log('[GTVD] Analyzing with AI...');
    const analyzer = new AIAnalyzer();
    const topics = await analyzer.analyzeAndRank();
    
    // 3. 生成 manifest
    console.log('[GTVD] Generating manifest...');
    const manifest = {
        date: new Date().toISOString().split('T')[0],
        video_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
        topics: topics.map(t => ({
            rank: t.rank,
            title: t.title,
            category: t.category,
            heat_score: t.heat_score,
            thumbnail: t.thumbnail,
            url: t.url,
            recommendation: t.recommendation
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
    process.exit(1);
});
