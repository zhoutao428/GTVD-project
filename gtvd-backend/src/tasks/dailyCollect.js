require('dotenv').config();

const path = require('path');
const DatabaseManager = require('../database');
const DataCollector = require('../services/dataCollector');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/gtvd.db');
const db = new DatabaseManager(dbPath);

const logger = (level, module, message) => {
    console.log(`[${level.toUpperCase()}] [${module}] ${message}`);
    db.log(level, module, message);
};

async function main() {
    console.log('Starting daily data collection...');
    
    const collector = new DataCollector(db, logger);
    
    try {
        const result = await collector.collect();
        console.log('Collection completed:', result);
        
        if (result.saved > 0) {
            console.log(`Successfully collected and saved ${result.saved} topics`);
        } else {
            console.log('No new topics were collected');
        }
    } catch (error) {
        console.error('Collection failed:', error.message);
        db.log('error', 'DailyCollect', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

main();
