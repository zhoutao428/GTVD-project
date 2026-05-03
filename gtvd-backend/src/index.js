require('dotenv').config();

const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./database');
const APIServer = require('./api/server');
const schedule = require('node-schedule');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/gtvd.db');

const db = new DatabaseManager(dbPath);

const logger = (level, module, message, details = null) => {
    console.log(`[${level.toUpperCase()}] [${module}] ${message}`);
    if (details) {
        console.log(`  Details:`, details);
    }
    db.log(level, module, message, details);
};

const apiServer = new APIServer(db, {
    videoDir: process.env.VIDEO_OUTPUT_DIR || path.join(__dirname, '../output/videos'),
    tempDir: process.env.TEMP_DIR || path.join(__dirname, '../temp')
});

async function dailyWorkflow() {
    const DataCollector = require('./services/dataCollector');
    const DataProcessor = require('./services/dataProcessor');
    const VideoGenerator = require('./services/videoGenerator');
    
    const today = new Date().toISOString().split('T')[0];
    logger('info', 'Workflow', `Starting daily workflow for ${today}`);

    try {
        logger('info', 'Workflow', 'Step 1: Data Collection');
        const collector = new DataCollector(db, logger);
        const collectResult = await collector.collect();
        logger('info', 'Workflow', `Collection complete: ${JSON.stringify(collectResult)}`);

        logger('info', 'Workflow', 'Step 2: Data Processing');
        const processor = new DataProcessor(db, logger);
        const unprocessedTopics = db.getUnprocessedTopics(today);
        const processResult = await processor.processAll(unprocessedTopics);
        logger('info', 'Workflow', `Processing complete: ${JSON.stringify(processResult)}`);

        logger('info', 'Workflow', 'Step 3: Video Generation');
        const topics = db.getHotTopicsByDate(today);
        const qualifiedTopics = topics.filter(t => {
            return !t.seo_filtered;
        }).sort((a, b) => b.热度指数 - a.热度指数).slice(0, 10);

        const report = {
            id: require('uuid').v4(),
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

        const videoResult = await generator.generateDailyReport(
            today,
            qualifiedTopics,
            path.join(__dirname, '../output')
        );
        logger('info', 'Workflow', `Video generation complete: ${JSON.stringify(videoResult)}`);

        logger('info', 'Workflow', 'Daily workflow completed successfully');
    } catch (error) {
        logger('error', 'Workflow', `Workflow failed: ${error.message}`, error.stack);
        db.updateDailyReport(today, {
            status: 'failed',
            error_message: error.message
        });
    }
}

function setupScheduler() {
    const collectCron = process.env.COLLECT_CRON || '0 6 * * *';
    const processCron = process.env.PROCESS_CRON || '30 6 * * *';
    const generateCron = process.env.GENERATE_CRON || '0 7 * * *';

    schedule.scheduleJob(collectCron, () => {
        logger('info', 'Scheduler', 'Triggered: Data Collection');
        const DataCollector = require('./services/dataCollector');
        const collector = new DataCollector(db, logger);
        collector.collect().catch(err => logger('error', 'Scheduler', err.message));
    });

    schedule.scheduleJob(processCron, () => {
        logger('info', 'Scheduler', 'Triggered: Data Processing');
        const DataProcessor = require('./services/dataProcessor');
        const processor = new DataProcessor(db, logger);
        const today = new Date().toISOString().split('T')[0];
        const unprocessedTopics = db.getUnprocessedTopics(today);
        processor.processAll(unprocessedTopics).catch(err => logger('error', 'Scheduler', err.message));
    });

    schedule.scheduleJob(generateCron, () => {
        logger('info', 'Scheduler', 'Triggered: Video Generation');
        dailyWorkflow();
    });

    logger('info', 'Scheduler', `Scheduler initialized`);
    logger('info', 'Scheduler', `Collect: ${collectCron}`);
    logger('info', 'Scheduler', `Process: ${processCron}`);
    logger('info', 'Scheduler', `Generate: ${generateCron}`);
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
        case 'collect':
            logger('info', 'CLI', 'Running data collection');
            const DataCollector = require('./services/dataCollector');
            const collector = new DataCollector(db, logger);
            const result = await collector.collect();
            console.log('Collection result:', result);
            break;

        case 'process':
            logger('info', 'CLI', 'Running data processing');
            const DataProcessor = require('./services/dataProcessor');
            const processor = new DataProcessor(db, logger);
            const today = new Date().toISOString().split('T')[0];
            const unprocessed = db.getUnprocessedTopics(today);
            const processResult = await processor.processAll(unprocessed);
            console.log('Processing result:', processResult);
            break;

        case 'generate':
            logger('info', 'CLI', 'Running video generation');
            dailyWorkflow();
            break;

        case 'workflow':
            logger('info', 'CLI', 'Running full daily workflow');
            await dailyWorkflow();
            break;

        case 'backup':
            logger('info', 'CLI', 'Running database backup');
            const backupPath = db.backup();
            console.log('Backup created:', backupPath);
            break;

        case 'server':
            logger('info', 'CLI', 'Starting API server');
            setupScheduler();
            await apiServer.start();
            break;

        default:
            console.log(`
GTVD Backend - Global Hotspot AI Video Daily Report System

Usage: node src/index.js <command>

Commands:
  collect   - Run data collection
  process   - Run data processing
  generate  - Run video generation
  workflow  - Run full daily workflow
  backup    - Backup database
  server    - Start API server (with scheduler)

Environment:
  PORT              - API server port (default: 3000)
  DB_PATH           - SQLite database path
  FFMPEG_PATH       - FFmpeg executable path
  VIDEO_WIDTH       - Video width (default: 720)
  VIDEO_HEIGHT      - Video height (default: 1280)

Examples:
  npm start server
  npm run collect
  npm run daily
            `);
    }

    process.on('SIGINT', () => {
        logger('info', 'Main', 'Shutting down...');
        db.close();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('Fatal error:', error);
    db.log('fatal', 'Main', error.message, error.stack);
    db.close();
    process.exit(1);
});
