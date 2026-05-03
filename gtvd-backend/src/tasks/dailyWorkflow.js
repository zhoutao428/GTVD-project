require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('../database');
const DataCollector = require('../services/dataCollector');
const DataProcessor = require('../services/dataProcessor');
const VideoGenerator = require('../services/videoGenerator');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/gtvd.db');
const outputDir = process.env.VIDEO_OUTPUT_DIR || path.join(__dirname, '../../output');

const db = new DatabaseManager(dbPath);

const logger = (level, module, message, details = null) => {
    console.log(`[${level.toUpperCase()}] [${module}] ${message}`);
    if (details) {
        console.log(`  Details:`, details);
    }
    db.log(level, module, message, details);
};

async function dailyWorkflow() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Starting daily workflow for ${today}`);
    
    try {
        console.log('Step 1: Data Collection');
        const collector = new DataCollector(db, logger);
        const collectResult = await collector.collect();
        logger('info', 'DailyWorkflow', `Collection: ${JSON.stringify(collectResult)}`);

        console.log('Step 2: Data Processing');
        const processor = new DataProcessor(db, logger);
        const unprocessedTopics = db.getUnprocessedTopics(today);
        const processResult = await processor.processAll(unprocessedTopics);
        logger('info', 'DailyWorkflow', `Processing: ${JSON.stringify(processResult)}`);

        console.log('Step 3: Video Generation');
        const topics = db.getHotTopicsByDate(today);
        const qualifiedTopics = topics
            .filter(t => t.is_processed === 0 || t.is_processed === false)
            .sort((a, b) => b.热度指数 - a.热度指数)
            .slice(0, 10);

        if (qualifiedTopics.length === 0) {
            console.log('No qualified topics for video generation');
            return;
        }

        const report = {
            id: uuidv4(),
            report_date: today,
            title: `全球热点AI日报 ${today}`,
            status: 'generating',
            topic_count: qualifiedTopics.length
        };
        db.insertDailyReport(report);

        const generator = new VideoGenerator(db, logger, {
            width: parseInt(process.env.VIDEO_WIDTH) || 720,
            height: parseInt(process.env.VIDEO_HEIGHT) || 1280
        });

        const videoResult = await generator.generateDailyReport(today, qualifiedTopics, outputDir);
        logger('info', 'DailyWorkflow', `Video: ${JSON.stringify(videoResult)}`);

        console.log('Daily workflow completed successfully');
        console.log(`Video: ${videoResult.videoPath}`);
        console.log(`Thumbnail: ${videoResult.thumbnailPath}`);
    } catch (error) {
        console.error('Workflow failed:', error.message);
        logger('error', 'DailyWorkflow', `Failed: ${error.message}`, error.stack);
        db.log('error', 'DailyWorkflow', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

dailyWorkflow();
