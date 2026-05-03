const { v4: uuidv4 } = require('uuid');

class DataProcessor {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        
        this.seoPatterns = [
            /点击查看|点击获取|点击领取|点击下载/i,
            /立即抢购|限时优惠|全场包邮/i,
            /广告|推广|赞助内容/i,
            /必看|震惊|惊人|曝光/i,
            /长按识别|扫码关注|微信搜索/i,
            /秒杀|折扣|返利|佣金/i,
            /刷单|兼职|日结|躺赚/i
        ];

        this.lowQualityPatterns = [
            /^[0-9]+$/,
            /^.{0,5}$/,
            /^\s+$/,
            /暂无|待更新|敬请期待/i
        ];

        this.sensitiveKeywords = [
            '色情', '赌博', '毒品', '暴力', '恐怖',
            '反动', '分裂', '邪教'
        ];

        this.qualityKeywords = {
            positive: ['突破', '创新', '发布', '重大', '首个', '领先', '进展'],
            negative: ['丑闻', '造假', '失败', '危机', '泄露', '漏洞']
        };
    }

    isSEOContent(title, summary) {
        const text = `${title} ${summary}`.toLowerCase();
        return this.seoPatterns.some(pattern => pattern.test(text));
    }

    isLowQuality(title, summary) {
        if (this.lowQualityPatterns.some(pattern => pattern.test(title))) {
            return true;
        }
        if (!summary || summary.length < 10) {
            return true;
        }
        return false;
    }

    detectSensitiveInfo(title, summary) {
        const text = `${title} ${summary}`;
        return this.sensitiveKeywords.some(keyword => text.includes(keyword));
    }

    calculateQualityScore(topic) {
        let score = 50;
        const title = topic.title || '';
        const summary = topic.summary || '';
        
        if (title.length >= 10 && title.length <= 50) {
            score += 10;
        } else if (title.length > 50) {
            score += 5;
        }

        if (summary.length >= 50 && summary.length <= 200) {
            score += 10;
        } else if (summary.length > 200) {
            score += 5;
        }

        const positiveCount = this.qualityKeywords.positive.filter(
            kw => title.includes(kw) || summary.includes(kw)
        ).length;
        score += positiveCount * 5;

        const negativeCount = this.qualityKeywords.negative.filter(
            kw => title.includes(kw) || summary.includes(kw)
        ).length;
        score -= negativeCount * 3;

        if (topic.source && ['KeyAPI', 'JuheAPI'].includes(topic.source)) {
            score += 10;
        }

        if (topic.heatIndex && topic.heatIndex > 5000) {
            score += 10;
        } else if (topic.heatIndex && topic.heatIndex > 1000) {
            score += 5;
        }

        return Math.min(100, Math.max(0, score));
    }

    extractKeywords(title, summary) {
        const text = `${title} ${summary}`;
        const words = text.match(/[\u4e00-\u9fa5]{2,}| [a-zA-Z]{3,}/g) || [];
        const wordCount = {};
        words.forEach(word => {
            const normalized = word.toLowerCase().trim();
            wordCount[normalized] = (wordCount[normalized] || 0) + 1;
        });
        
        return Object.entries(wordCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    analyzeSentiment(title, summary) {
        const positiveWords = ['好', '棒', '优秀', '突破', '创新', '成功', '重大', '领先'];
        const negativeWords = ['坏', '差', '失败', '危机', '问题', '漏洞', '丑闻'];
        
        const text = `${title} ${summary}`;
        let score = 0;
        
        positiveWords.forEach(word => {
            if (text.includes(word)) score++;
        });
        negativeWords.forEach(word => {
            if (text.includes(word)) score--;
        });
        
        if (score > 0) return 'positive';
        if (score < 0) return 'negative';
        return 'neutral';
    }

    assessRiskLevel(topic) {
        if (this.detectSensitiveInfo(topic.title, topic.summary)) {
            return 'high';
        }
        
        const qualityScore = this.calculateQualityScore(topic);
        if (qualityScore < 30) {
            return 'medium';
        }
        
        return 'low';
    }

    cleanTitle(title) {
        return title
            .replace(/^【.*?】/, '')
            .replace(/^#.*?#/, '')
            .replace(/^\[.*?\]/, '')
            .replace(/^(转发|收藏|分享):/i, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    cleanSummary(summary) {
        return summary
            .replace(/http[s]?:\/\/\S+/g, '')
            .replace(/@[\w]+/g, '')
            .replace(/#[^#]+#/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async processTopic(topic) {
        const processed = {
            id: uuidv4(),
            topic_id: topic.id,
            clean_title: this.cleanTitle(topic.title),
            clean_summary: this.cleanSummary(topic.summary || ''),
            seo_filtered: this.isSEOContent(topic.title, topic.summary),
            quality_score: this.calculateQualityScore(topic),
            keywords: this.extractKeywords(topic.title, topic.summary).join(','),
            sentiment: this.analyzeSentiment(topic.title, topic.summary),
            risk_level: this.assessRiskLevel(topic)
        };

        if (processed.seo_filtered) {
            this.logger('warn', 'DataProcessor', `SEO content filtered: ${topic.title}`);
        }

        if (processed.quality_score < 30) {
            this.logger('warn', 'DataProcessor', `Low quality detected: ${topic.title}, score: ${processed.quality_score}`);
        }

        return processed;
    }

    async processAll(unprocessedTopics) {
        this.logger('info', 'DataProcessor', `Starting to process ${unprocessedTopics.length} topics`);
        
        const results = {
            total: unprocessedTopics.length,
            processed: 0,
            filtered: 0,
            lowQuality: 0
        };

        for (const topic of unprocessedTopics) {
            const processed = await this.processTopic(topic);
            
            if (processed.seo_filtered) {
                results.filtered++;
                this.db.markTopicProcessed(topic.id);
                continue;
            }

            if (processed.quality_score < 30) {
                results.lowQuality++;
            }

            try {
                this.db.insertProcessedContent(processed);
                this.db.markTopicProcessed(topic.id);
                results.processed++;
            } catch (error) {
                this.logger('error', 'DataProcessor', `Failed to save processed content: ${error.message}`);
            }
        }

        this.logger('info', 'DataProcessor', `Processing complete. Processed: ${results.processed}, Filtered: ${results.filtered}, LowQuality: ${results.lowQuality}`);
        return results;
    }
}

module.exports = DataProcessor;
