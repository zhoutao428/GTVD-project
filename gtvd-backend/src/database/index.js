const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class DatabaseManager {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.init();
    }

    init() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.createTables();
    }

    createTables() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS hot_topics (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                summary TEXT,
                source TEXT NOT NULL,
                source_url TEXT,
                category TEXT,
                tags TEXT,
               热度指数 INTEGER DEFAULT 0,
                pub_date TEXT,
                collect_date TEXT NOT NULL,
                is_processed INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS processed_content (
                id TEXT PRIMARY KEY,
                topic_id TEXT NOT NULL,
                clean_title TEXT NOT NULL,
                clean_summary TEXT,
                seo_filtered INTEGER DEFAULT 0,
                quality_score REAL DEFAULT 0,
                keywords TEXT,
                sentiment TEXT,
                risk_level TEXT,
                processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
            );

            CREATE TABLE IF NOT EXISTS daily_reports (
                id TEXT PRIMARY KEY,
                report_date TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                topic_count INTEGER DEFAULT 0,
                video_path TEXT,
                thumbnail_path TEXT,
                duration INTEGER,
                file_size INTEGER,
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS report_topics (
                id TEXT PRIMARY KEY,
                report_id TEXT NOT NULL,
                topic_id TEXT NOT NULL,
                display_order INTEGER NOT NULL,
                clip_start_time REAL,
                clip_duration REAL,
                subtitle_text TEXT,
                FOREIGN KEY (report_id) REFERENCES daily_reports(id),
                FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
            );

            CREATE TABLE IF NOT EXISTS system_logs (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                module TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS backups (
                id TEXT PRIMARY KEY,
                backup_path TEXT NOT NULL,
                backup_size INTEGER,
                table_counts TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_hot_topics_collect_date ON hot_topics(collect_date);
            CREATE INDEX IF NOT EXISTS idx_hot_topics_category ON hot_topics(category);
            CREATE INDEX IF NOT EXISTS idx_processed_content_topic ON processed_content(topic_id);
            CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
            CREATE INDEX IF NOT EXISTS idx_report_topics_report ON report_topics(report_id);
            CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
        `);
    }

    log(level, module, message, details = null) {
        const stmt = this.db.prepare(`
            INSERT INTO system_logs (id, level, module, message, details)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(uuidv4(), level, module, message, details ? JSON.stringify(details) : null);
    }

    insertHotTopic(topic) {
        const stmt = this.db.prepare(`
            INSERT INTO hot_topics (id, title, summary, source, source_url, category, tags,热度指数, pub_date, collect_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            topic.id || uuidv4(),
            topic.title,
            topic.summary,
            topic.source,
            topic.source_url,
            topic.category,
            topic.tags,
            topic.heatIndex || 0,
            topic.pub_date,
            topic.collect_date
        );
    }

    insertProcessedContent(content) {
        const stmt = this.db.prepare(`
            INSERT INTO processed_content (id, topic_id, clean_title, clean_summary, seo_filtered, quality_score, keywords, sentiment, risk_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            content.id || uuidv4(),
            content.topic_id,
            content.clean_title,
            content.clean_summary,
            content.seo_filtered ? 1 : 0,
            content.quality_score,
            content.keywords,
            content.sentiment,
            content.risk_level
        );
    }

    insertDailyReport(report) {
        const stmt = this.db.prepare(`
            INSERT INTO daily_reports (id, report_date, title, status, topic_count)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(
            report.id || uuidv4(),
            report.report_date,
            report.title,
            report.status || 'pending',
            report.topic_count || 0
        );
    }

    updateDailyReport(id, updates) {
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates);
        const stmt = this.db.prepare(`
            UPDATE daily_reports SET ${fields} WHERE id = ?
        `);
        return stmt.run(...values, id);
    }

    getHotTopicsByDate(date) {
        const stmt = this.db.prepare(`
            SELECT * FROM hot_topics WHERE collect_date = ? ORDER BY 热度指数 DESC LIMIT 20
        `);
        return stmt.all(date);
    }

    getUnprocessedTopics(date) {
        const stmt = this.db.prepare(`
            SELECT * FROM hot_topics WHERE collect_date = ? AND is_processed = 0
        `);
        return stmt.all(date);
    }

    markTopicProcessed(id) {
        const stmt = this.db.prepare(`
            UPDATE hot_topics SET is_processed = 1 WHERE id = ?
        `);
        return stmt.run(id);
    }

    getLatestReport() {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT 1
        `);
        return stmt.get();
    }

    getReportByDate(date) {
        const stmt = this.db.prepare(`
            SELECT * FROM daily_reports WHERE report_date = ?
        `);
        return stmt.get(date);
    }

    getReportTopics(reportId) {
        const stmt = this.db.prepare(`
            SELECT rt.*, ht.title, ht.summary, ht.category, pc.clean_title, pc.clean_summary, pc.quality_score
            FROM report_topics rt
            JOIN hot_topics ht ON rt.topic_id = ht.id
            LEFT JOIN processed_content pc ON rt.topic_id = pc.topic_id
            WHERE rt.report_id = ?
            ORDER BY rt.display_order
        `);
        return stmt.all(reportId);
    }

    getSystemLogs(limit = 100) {
        const stmt = this.db.prepare(`
            SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?
        `);
        return stmt.all(limit);
    }

    backup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(path.dirname(this.dbPath), '..', 'backups', `gtvd-${timestamp}.db`);
        const dir = path.dirname(backupPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db.backup(backupPath);

        const tableCounts = {};
        const tables = ['hot_topics', 'processed_content', 'daily_reports', 'report_topics'];
        tables.forEach(table => {
            const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
            tableCounts[table] = count.count;
        });

        const stmt = this.db.prepare(`
            INSERT INTO backups (id, backup_path, backup_size, table_counts)
            VALUES (?, ?, ?, ?)
        `);
        const size = fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0;
        stmt.run(uuidv4(), backupPath, size, JSON.stringify(tableCounts));

        return backupPath;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;
