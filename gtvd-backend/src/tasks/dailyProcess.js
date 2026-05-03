require('dotenv').config();

const path = require('path');
const DatabaseManager = require('../database');
const DataProcessor = require('../services/dataProcessor');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/gtvd.db');
const db = new DatabaseManager(dbPath);

const logger = (level, module, message) => {
    console.log(`[${level.toUpperCase()}] [${module}] ${message}`);
    db.log(level, module, message);
};

async function main() {
    console.log('Starting daily data processing...');
    
    const processor = new DataProcessor(db, logger);
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const unprocessedTopics = db.getUnprocessedTopics(today);
        console.log(`Found ${unprocessedTopics.length} unprocessed topics`);
        
        if (unprocessedTopics.length === 0) {
            console.log('No topics to process');
            return;
        }
        
        const result = await processor.processAll(unprocessedTopics);
        console.log('Processing completed:', result);
        
        if (result.processed > 0) {
            console.log(`Successfully processed ${result.processed} topics`);
        }
    } catch (error) {
        console.error('Processing failed:', error.message);
        db.log('error', 'DailyProcess', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
