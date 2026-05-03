require('dotenv').config();

const path = require('path');
const fs = require('fs');
const DatabaseManager = require('../database');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/gtvd.db');
const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');

const db = new DatabaseManager(dbPath);

function main() {
    console.log('Starting database backup...');
    
    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const backupPath = db.backup();
        console.log(`Backup created successfully: ${backupPath}`);
        
        const stats = fs.statSync(backupPath);
        console.log(`Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        cleanupOldBackups();
    } catch (error) {
        console.error('Backup failed:', error.message);
        process.exit(1);
    } finally {
        db.close();
    }
}

function cleanupOldBackups() {
    const maxBackups = 30;
    const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.db'))
        .map(f => ({
            name: f,
            path: path.join(backupDir, f),
            time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
    
    if (files.length > maxBackups) {
        const toDelete = files.slice(maxBackups);
        toDelete.forEach(f => {
            fs.unlinkSync(f.path);
            console.log(`Deleted old backup: ${f.name}`);
        });
    }
    
    console.log(`Total backups: ${files.length}`);
}

main();
