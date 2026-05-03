require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

class AIAnalyzer {
    constructor() {
        this.apiKey = process.env.AI_API_KEY;
        this.baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com';
        this.model = process.env.AI_MODEL || 'deepseek-chat';
        this.retryCount = 3;
        this.retryDelay = 2000;
        this.timeout = 60000;

        console.log('[AIAnalyzer] DeepSeek API:', this.apiKey ? 'configured' : 'NOT configured');
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getSystemPrompt() {
        return `你是一个资深内容分析师，每天从全球热点中精选出当日最值得看的十大爆款视频。请完成以下任务：

1. **多源去重合并**：对收集到的热点进行去重，计算综合热度分
2. **精确分类**：将每个热点分类到以下类别之一：
   - AI与科技
   - 平台爆款-TikTok
   - 平台爆款-YouTube
   - 社会事件
   - 娱乐
   - 财经
   - 生活创意
   - 其他
3. **爆款因素分析**：分析为什么火、情绪关键词、目标人群，并用一句话写出推荐语（口语化，≤25字）
4. **输出TOP10**：按热度分从高到低输出TOP10，同时列出1-3条AI焦点关注

输出格式要求：
必须返回严格合法的JSON数组，格式如下：
[
  {
    "rank": 1,
    "title": "话题标题",
    "platform": "平台名称",
    "category": "分类",
    "heat_score": 热度分(0-100),
    "reason_short": "爆款原因简述",
    "recommendation_voice": "推荐语(≤25字)",
    "source_link": "源链接",
    "thumbnail": "封面图URL"
  }
]

请确保JSON格式完全合法，不要包含任何其他文字。`;
    }

    async callDeepSeek(messages) {
        const response = await axios.post(
            `${this.baseUrl}/v1/chat/completions`,
            {
                model: this.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 4000
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: this.timeout
            }
        );

        if (response.data && response.data.choices && response.data.choices[0]) {
            return response.data.choices[0].message.content;
        }
        throw new Error('DeepSeek API response format error');
    }

    parseJSONResponse(content) {
        let jsonStr = content.trim();

        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }

        const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }

        try {
            const parsed = JSON.parse(jsonStr);

            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }

            return parsed.map((item, index) => ({
                rank: item.rank || index + 1,
                title: String(item.title || '').substring(0, 200),
                platform: String(item.platform || item.source_platforms?.[0] || '').substring(0, 50),
                category: String(item.category || '其他').substring(0, 50),
                heat_score: Math.max(0, Math.min(100, Number(item.heat_score) || 50)),
                reason_short: String(item.reason_short || '').substring(0, 200),
                recommendation_voice: String(item.recommendation_voice || item.recommendation || '').substring(0, 50),
                source_link: String(item.source_link || item.url || ''),
                thumbnail: String(item.thumbnail || '')
            })).slice(0, 10);
        } catch (error) {
            throw new Error(`JSON parse error: ${error.message}`);
        }
    }

    formatTopicsForPrompt(topics) {
        return topics.map((topic, index) => {
            const title = topic.title || 'Unknown';
            const platform = topic.platform || 'unknown';
            const heat = topic.heat || 0;
            return `${index + 1}. [${platform}] ${title} (热度: ${heat})`;
        }).join('\n');
    }

    async analyzeWithRetry(topics) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryCount; attempt++) {
            try {
                return await this.analyze(topics);
            } catch (error) {
                lastError = error;
                if (attempt < this.retryCount) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`[AIAnalyzer] Attempt ${attempt} failed, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }

        throw new Error(`All ${this.retryCount} attempts failed: ${lastError.message}`);
    }

    async analyze(topics) {
        if (!topics || topics.length === 0) {
            throw new Error('No topics provided');
        }

        if (!this.apiKey) {
            throw new Error('AI_API_KEY not configured');
        }

        console.log(`[AIAnalyzer] Analyzing ${topics.length} topics...`);

        const formattedTopics = this.formatTopicsForPrompt(topics);
        const messages = [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: `请分析以下热点话题，输出TOP10：\n\n${formattedTopics}` }
        ];

        const response = await this.callDeepSeek(messages);
        const result = this.parseJSONResponse(response);

        console.log(`[AIAnalyzer] Analysis complete, ${result.length} topics generated`);
        return result;
    }

    async loadFromFile(filename = 'data-fetcher.json') {
        if (!fs.existsSync(filename)) {
            throw new Error(`File not found: ${filename}`);
        }

        const content = fs.readFileSync(filename, 'utf-8');
        return JSON.parse(content);
    }

    async saveToFile(result, filename = 'ai-analysis-result.json') {
        const json = JSON.stringify(result, null, 2);
        fs.writeFileSync(filename, json, 'utf-8');
        console.log(`[AIAnalyzer] Saved to ${filename}`);
        return filename;
    }
}

async function main() {
    const analyzer = new AIAnalyzer();
    
    try {
        const topics = await analyzer.loadFromFile();
        const result = await analyzer.analyzeWithRetry(topics);
        await analyzer.saveToFile(result);
        return result;
    } catch (error) {
        console.error('[AIAnalyzer] Fatal error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = AIAnalyzer;
