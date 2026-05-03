const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

class APIServer {
    constructor(db, config = {}) {
        this.db = db;
        this.config = config;
        this.app = express();
        this.server = null;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(helmet({
            contentSecurityPolicy: false
        }));
        this.app.use(cors());
        this.app.use(compression());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(morgan('combined'));
        
        this.app.use('/static', express.static(path.join(__dirname, '../../output')));
    }

    setupRoutes() {
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        this.app.get('/api/report/latest', (req, res) => {
            try {
                const report = this.db.getLatestReport();
                if (!report) {
                    return res.status(404).json({ error: 'No report found' });
                }

                const topics = this.db.getReportTopics(report.id);
                
                res.json({
                    id: report.id,
                    report_date: report.report_date,
                    title: report.title,
                    status: report.status,
                    topic_count: report.topic_count,
                    video_url: report.video_path ? `/static/videos/${path.basename(report.video_path)}` : null,
                    thumbnail_url: report.thumbnail_path ? `/static/thumbnails/${path.basename(report.thumbnail_path)}` : null,
                    duration: report.duration,
                    file_size: report.file_size,
                    created_at: report.created_at,
                    completed_at: report.completed_at,
                    topics: topics.map(t => ({
                        id: t.id,
                        topic_id: t.topic_id,
                        title: t.title,
                        summary: t.summary,
                        clean_title: t.clean_title,
                        clean_summary: t.clean_summary,
                        category: t.category,
                        quality_score: t.quality_score,
                        display_order: t.display_order
                    }))
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/report/:date', (req, res) => {
            try {
                const report = this.db.getReportByDate(req.params.date);
                if (!report) {
                    return res.status(404).json({ error: 'Report not found' });
                }

                const topics = this.db.getReportTopics(report.id);
                
                res.json({
                    id: report.id,
                    report_date: report.report_date,
                    title: report.title,
                    status: report.status,
                    topic_count: report.topic_count,
                    video_url: report.video_path ? `/static/videos/${path.basename(report.video_path)}` : null,
                    thumbnail_url: report.thumbnail_path ? `/static/thumbnails/${path.basename(report.thumbnail_path)}` : null,
                    duration: report.duration,
                    file_size: report.file_size,
                    created_at: report.created_at,
                    completed_at: report.completed_at,
                    topics: topics.map(t => ({
                        id: t.id,
                        topic_id: t.topic_id,
                        title: t.title,
                        summary: t.summary,
                        clean_title: t.clean_title,
                        clean_summary: t.clean_summary,
                        category: t.category,
                        quality_score: t.quality_score,
                        display_order: t.display_order
                    }))
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/topics', (req, res) => {
            try {
                const date = req.query.date || new Date().toISOString().split('T')[0];
                const topics = this.db.getHotTopicsByDate(date);
                
                res.json({
                    date: date,
                    count: topics.length,
                    topics: topics.map(t => ({
                        id: t.id,
                        title: t.title,
                        summary: t.summary,
                        source: t.source,
                        category: t.category,
                        heat_index: t.热度指数,
                        is_processed: t.is_processed === 1
                    }))
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/logs', (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 100;
                const logs = this.db.getSystemLogs(limit);
                
                res.json({
                    count: logs.length,
                    logs: logs
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/stats', (req, res) => {
            try {
                const latestReport = this.db.getLatestReport();
                const todayTopics = this.db.getHotTopicsByDate(new Date().toISOString().split('T')[0]);
                
                res.json({
                    latest_report: latestReport ? {
                        date: latestReport.report_date,
                        status: latestReport.status,
                        topic_count: latestReport.topic_count,
                        video_ready: latestReport.status === 'completed'
                    } : null,
                    today_topics_count: todayTopics.length,
                    system_uptime: process.uptime(),
                    node_version: process.version
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/trigger/collect', (req, res) => {
            const key = req.headers['x-api-key'] || req.body.key;
            if (key !== process.env.API_SECRET) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            res.json({ message: 'Collection triggered', status: 'processing' });
            
            setImmediate(() => {
                const DataCollector = require('../services/dataCollector');
                const collector = new DataCollector(this.db, (level, module, msg) => {
                    this.db.log(level, module, msg);
                });
                collector.collect().catch(err => {
                    this.db.log('error', 'API', `Collection error: ${err.message}`);
                });
            });
        });

        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });

        this.app.use((err, req, res, next) => {
            this.db.log('error', 'API', `Unhandled error: ${err.message}`);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    start(port = process.env.PORT || 3000) {
        return new Promise((resolve) => {
            this.server = this.app.listen(port, () => {
                console.log(`API Server running on port ${port}`);
                resolve(this.server);
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

module.exports = APIServer;
