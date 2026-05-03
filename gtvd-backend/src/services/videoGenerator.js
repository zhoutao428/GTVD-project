const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class VideoGenerator {
    constructor(db, logger, config = {}) {
        this.db = db;
        this.logger = logger;
        this.config = {
            width: parseInt(process.env.VIDEO_WIDTH) || 720,
            height: parseInt(process.env.VIDEO_HEIGHT) || 1280,
            fps: parseInt(process.env.VIDEO_FPS) || 30,
            bitrate: process.env.VIDEO_BITRATE || '2000k',
            codec: process.env.VIDEO_CODEC || 'libx264',
            ...config
        };
        
        this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        this.ffprobePath = process.env.FFMPROBE_PATH || 'ffprobe';
        ffmpeg.setFfmpegPath(this.ffmpegPath);
        ffmpeg.setFfprobePath(this.ffprobePath);
    }

    async generateThumbnail(videoPath, outputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    count: 1,
                    folder: path.dirname(outputPath),
                    filename: path.basename(outputPath),
                    size: `${this.config.width}x${this.config.height}`
                })
                .on('end', () => {
                    this.logger('info', 'VideoGenerator', `Thumbnail generated: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    this.logger('error', 'VideoGenerator', `Thumbnail generation failed: ${err.message}`);
                    reject(err);
                });
        });
    }

    async createBackgroundVideo(topic, duration, outputPath) {
        const { width, height, fps, bitrate, codec } = this.config;
        
        const categoryColors = {
            'ai': '#667eea',
            'tech': '#11998e',
            'hot': '#e74c3c',
            'default': '#2c3e50'
        };
        
        const bgColor = categoryColors[topic.category] || categoryColors.default;
        
        return new Promise((resolve, reject) => {
            const tempFile = outputPath + '.tmp.mp4';
            
            ffmpeg()
                .input(`color=c=${bgColor}:s=${width}x${height}:r=${fps}`)
                .inputFormat('lavfi')
                .duration(duration)
                .videoCodec(codec)
                .outputOptions([
                    `-b:v ${bitrate}`,
                    '-pix_fmt yuv420p',
                    '-movflags +faststart'
                ])
                .output(tempFile)
                .on('start', (command) => {
                    this.logger('info', 'VideoGenerator', `FFmpeg command: ${command}`);
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        this.logger('info', 'VideoGenerator', `Progress: ${progress.percent.toFixed(1)}%`);
                    }
                })
                .on('end', () => {
                    fs.renameSync(tempFile, outputPath);
                    this.logger('info', 'VideoGenerator', `Background video created: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    this.logger('error', 'VideoGenerator', `Background video creation failed: ${err.message}`);
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                    reject(err);
                })
                .run();
        });
    }

    async addTextOverlay(videoPath, text, outputPath, options = {}) {
        const {
            fontsize = 24,
            fontcolor = 'white',
            x = '(w-text_w)/2',
            y = '(h-text_h)/2',
            duration
        } = options;

        const escapedText = text.replace(/'/g, "'\\''").replace(/:/g, '\\:');

        return new Promise((resolve, reject) => {
            const tempFile = outputPath + '.tmp.mp4';
            
            let command = ffmpeg(videoPath)
                .videoFilters(`drawtext=text='${escapedText}':fontsize=${fontsize}:fontcolor=${fontcolor}:x=${x}:y=${y}`);

            if (duration) {
                command = command.setDuration(duration);
            }

            command.output(tempFile)
                .on('end', () => {
                    fs.renameSync(tempFile, outputPath);
                    this.logger('info', 'VideoGenerator', `Text overlay added: ${text.substring(0, 30)}...`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    this.logger('error', 'VideoGenerator', `Text overlay failed: ${err.message}`);
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                    reject(err);
                })
                .run();
        });
    }

    async concatenateVideos(videoPaths, outputPath) {
        if (videoPaths.length === 0) {
            throw new Error('No videos to concatenate');
        }

        if (videoPaths.length === 1) {
            fs.copyFileSync(videoPaths[0], outputPath);
            return outputPath;
        }

        const listFile = outputPath + '.txt';
        const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(listFile, listContent);

        return new Promise((resolve, reject) => {
            const tempFile = outputPath + '.tmp.mp4';
            
            ffmpeg()
                .input(listFile)
                .inputFormat('concat')
                .videoCodec(this.config.codec)
                .outputOptions([
                    `-b:v ${this.config.bitrate}`,
                    '-pix_fmt yuv420p',
                    '-movflags +faststart'
                ])
                .output(tempFile)
                .on('end', () => {
                    fs.unlinkSync(listFile);
                    fs.renameSync(tempFile, outputPath);
                    this.logger('info', 'VideoGenerator', `Videos concatenated: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    this.logger('error', 'VideoGenerator', `Concatenation failed: ${err.message}`);
                    if (fs.existsSync(listFile)) {
                        fs.unlinkSync(listFile);
                    }
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                    reject(err);
                })
                .run();
        });
    }

    async generateTopicClip(topic, processedContent, outputDir, clipDuration = 30) {
        const clipId = uuidv4();
        const clipPath = path.join(outputDir, `clip_${clipId}.mp4`);
        
        try {
            await this.createBackgroundVideo(topic, clipDuration, clipPath);
            
            const titleText = processedContent.clean_title || topic.title;
            await this.addTextOverlay(clipPath, titleText, clipPath, {
                fontsize: 32,
                fontcolor: 'white',
                y: `(${this.config.height}/2)-50`
            });

            if (processedContent.clean_summary) {
                const summaryText = processedContent.clean_summary.substring(0, 100);
                await this.addTextOverlay(clipPath, summaryText, clipPath, {
                    fontsize: 20,
                    fontcolor: 'white',
                    y: `(${this.config.height}/2)+20`
                });
            }

            const sourceText = `来源: ${topic.source}`;
            await this.addTextOverlay(clipPath, sourceText, clipPath, {
                fontsize: 16,
                fontcolor: '#cccccc',
                y: this.config.height - 50
            });

            this.logger('info', 'VideoGenerator', `Topic clip generated: ${topic.title.substring(0, 30)}...`);
            return clipPath;
        } catch (error) {
            this.logger('error', 'VideoGenerator', `Clip generation failed for ${topic.title}: ${error.message}`);
            throw error;
        }
    }

    async generateDailyReport(reportId, topics, outputDir) {
        this.logger('info', 'VideoGenerator', `Starting video generation for report ${reportId}`);
        
        const report = this.db.getReportByDate(reportId) || {};
        const reportDate = new Date().toLocaleDateString('zh-CN');
        const title = `全球热点AI日报 | ${reportDate}`;
        
        const tempDir = path.join(outputDir, 'temp', reportId);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const clipPaths = [];
        const topicDuration = 25;
        const introDuration = 5;
        
        const introPath = path.join(tempDir, 'intro.mp4');
        await this.createBackgroundVideo({ category: 'default' }, introDuration, introPath);
        await this.addTextOverlay(introPath, title, introPath, {
            fontsize: 36,
            fontcolor: 'white',
            y: `(${this.config.height}/2)-30`
        });
        await this.addTextOverlay(introPath, '每日自动生成 | 数据来源: KeyAPI/聚合数据', introPath, {
            fontsize: 18,
            fontcolor: '#aaaaaa',
            y: `(${this.config.height}/2)+30`
        });
        clipPaths.push(introPath);

        for (let i = 0; i < Math.min(topics.length, 10); i++) {
            const topic = topics[i];
            const processedContent = topic.processed_content || {};
            
            try {
                const clipPath = await this.generateTopicClip(
                    topic,
                    processedContent,
                    tempDir,
                    topicDuration
                );
                clipPaths.push(clipPath);
            } catch (error) {
                this.logger('error', 'VideoGenerator', `Failed to generate clip for topic ${i + 1}: ${error.message}`);
            }
        }

        const outroDuration = 3;
        const outroPath = path.join(tempDir, 'outro.mp4');
        await this.createBackgroundVideo({ category: 'default' }, outroDuration, outroPath);
        await this.addTextOverlay(outroPath, '感谢观看 | GTVD全球热点AI日报', outroPath, {
            fontsize: 28,
            fontcolor: 'white',
            y: `(${this.config.height}/2)-20`
        });
        await this.addTextOverlay(outroPath, '了解更多: gtvd.example.com', outroPath, {
            fontsize: 16,
            fontcolor: '#aaaaaa',
            y: `(${this.config.height}/2)+20`
        });
        clipPaths.push(outroPath);

        const finalVideoPath = path.join(outputDir, 'videos', `${reportId}.mp4`);
        const finalVideoDir = path.dirname(finalVideoPath);
        if (!fs.existsSync(finalVideoDir)) {
            fs.mkdirSync(finalVideoDir, { recursive: true });
        }

        await this.concatenateVideos(clipPaths, finalVideoPath);

        const thumbnailPath = path.join(outputDir, 'thumbnails', `${reportId}.jpg`);
        const thumbnailDir = path.dirname(thumbnailPath);
        if (!fs.existsSync(thumbnailDir)) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
        }
        
        try {
            await this.generateThumbnail(finalVideoPath, thumbnailPath);
        } catch (error) {
            this.logger('warn', 'VideoGenerator', `Thumbnail generation failed: ${error.message}`);
        }

        const stats = fs.statSync(finalVideoPath);
        const duration = clipPaths.length * (topicDuration + 2);

        this.db.updateDailyReport(report.id, {
            status: 'completed',
            video_path: finalVideoPath,
            thumbnail_path: thumbnailPath,
            duration: duration,
            file_size: stats.size,
            completed_at: new Date().toISOString()
        });

        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (error) {
            this.logger('warn', 'VideoGenerator', `Failed to cleanup temp dir: ${error.message}`);
        }

        this.logger('info', 'VideoGenerator', `Video generation complete: ${finalVideoPath}`);
        
        return {
            videoPath: finalVideoPath,
            thumbnailPath: thumbnailPath,
            duration: duration,
            fileSize: stats.size,
            topicCount: clipPaths.length - 2
        };
    }
}

module.exports = VideoGenerator;
