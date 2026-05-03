require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class VideoBuilder {
    constructor() {
        this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
        this.videoWidth = parseInt(process.env.VIDEO_WIDTH || '1080', 10);
        this.videoHeight = parseInt(process.env.VIDEO_HEIGHT || '1920', 10);
        this.videoFps = parseInt(process.env.VIDEO_FPS || '30', 10);
        this.videoBitrate = process.env.VIDEO_BITRATE || '3000k';
        
        this.outputDir = process.env.VIDEO_OUTPUT_DIR || './output/videos';
        this.tempDir = process.env.TEMP_DIR || './temp';
        
        this.edgeTtsEnabled = process.env.EDGE_TTS_ENABLED === 'true';
        this.edgeTtsVoice = process.env.EDGE_TTS_VOICE || 'zh-CN-XiaoxiaoNeural';
        
        this.ensureDirectories();
        
        console.log('[VideoBuilder] Video params:', `${this.videoWidth}x${this.videoHeight}@${this.videoFps}fps`);
        console.log('[VideoBuilder] Edge TTS:', this.edgeTtsEnabled ? 'enabled' : 'disabled');
    }

    ensureDirectories() {
        [this.outputDir, this.tempDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    execFFmpeg(command) {
        return new Promise((resolve, reject) => {
            exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`FFmpeg error: ${error.message}\nStderr: ${stderr}`));
                    return;
                }
                resolve();
            });
        });
    }

    async createIntroClip() {
        const introPath = path.join(this.tempDir, `intro.mp4`);
        
        const dateStr = new Date().toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        const command = [
            this.ffmpegPath,
            '-f', 'lavfi',
            `-i`, `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=3`,
            '-vf', `"drawtext=text='🌍 GTVD 全球热点AI日报':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-100:enable='between(t,0,3)',drawtext=text='${dateStr}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+50:enable='between(t,0,3)'`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            `"${introPath}"`
        ].join(' ');

        await this.execFFmpeg(command);
        return introPath;
    }

    async createOutroClip() {
        const outroPath = path.join(this.tempDir, `outro.mp4`);
        
        const command = [
            this.ffmpegPath,
            '-f', 'lavfi',
            `-i`, `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=5`,
            '-vf', `"drawtext=text='感谢观看':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-30:enable='between(t,0,5)',drawtext=text='明天再见！':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+50:enable='between(t,0,5)'`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            `"${outroPath}"`
        ].join(' ');

        await this.execFFmpeg(command);
        return outroPath;
    }

    async synthesizeSpeech(text, outputPath) {
        if (!this.edgeTtsEnabled) {
            console.log('[VideoBuilder] Edge TTS disabled, skipping audio');
            return null;
        }

        return new Promise((resolve, reject) => {
            const safeText = text.replace(/"/g, '\\"').replace(/'/g, "\\'");
            const command = `edge-tts --voice "${this.edgeTtsVoice}" --text "${safeText}" --write-media "${outputPath}"`;

            exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
                if (error) {
                    console.warn(`[VideoBuilder] Edge TTS failed for: ${text.substring(0, 20)}...`);
                    resolve(null);
                    return;
                }
                console.log(`[VideoBuilder] TTS generated: ${outputPath}`);
                resolve(outputPath);
            });
        });
    }

    async createTopicClip(topic, index) {
        const clipPath = path.join(this.tempDir, `clip_${topic.rank}.mp4`);
        const audioPath = path.join(this.tempDir, `audio_${topic.rank}.mp3`);
        const duration = 8;

        await this.synthesizeSpeech(topic.recommendation_voice || topic.title, audioPath);

        const hasAudio = fs.existsSync(audioPath);
        const hasThumbnail = topic.thumbnail && topic.thumbnail.startsWith('http');

        let command;
        if (hasThumbnail) {
            const thumbnailPath = path.join(this.tempDir, `thumb_${topic.rank}.jpg`);
            await this.downloadFile(topic.thumbnail, thumbnailPath);

            if (hasAudio) {
                command = [
                    this.ffmpegPath,
                    '-loop', '1',
                    '-i', `"${thumbnailPath}"`,
                    '-i', `"${audioPath}"`,
                    '-t', String(duration),
                    '-vf', `"zoompan=z='min(zoom+0.005,1.2)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${this.videoWidth}x${this.videoHeight},scale=${this.videoWidth}:${this.videoHeight}:force_original_aspect_ratio=decrease,pad=${this.videoWidth}:${this.videoHeight}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${topic.category}':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=20:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=${this.videoHeight - 80}:enable='between(t,0,${duration})'"`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-shortest',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    `"${clipPath}"`
                ].join(' ');
            } else {
                command = [
                    this.ffmpegPath,
                    '-loop', '1',
                    '-i', `"${thumbnailPath}"`,
                    '-t', String(duration),
                    '-vf', `"zoompan=z='min(zoom+0.005,1.2)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${this.videoWidth}x${this.videoHeight},scale=${this.videoWidth}:${this.videoHeight}:force_original_aspect_ratio=decrease,pad=${this.videoWidth}:${this.videoHeight}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${topic.category}':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=20:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=${this.videoHeight - 80}:enable='between(t,0,${duration})'"`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    `"${clipPath}"`
                ].join(' ');
            }
        } else {
            if (hasAudio) {
                command = [
                    this.ffmpegPath,
                    '-f', 'lavfi',
                    `-i`, `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=${duration}`,
                    '-i', `"${audioPath}"`,
                    '-vf', `"drawtext=text='${topic.category}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-80:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+30:enable='between(t,0,${duration})'"`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-shortest',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    `"${clipPath}"`
                ].join(' ');
            } else {
                command = [
                    this.ffmpegPath,
                    '-f', 'lavfi',
                    `-i`, `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=${duration}`,
                    '-vf', `"drawtext=text='${topic.category}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-80:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+30:enable='between(t,0,${duration})'"`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    `"${clipPath}"`
                ].join(' ');
            }
        }

        await this.execFFmpeg(command);
        return clipPath;
    }

    async downloadFile(url, destPath) {
        try {
            const axios = require('axios');
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            fs.writeFileSync(destPath, response.data);
            return destPath;
        } catch {
            return null;
        }
    }

    async concatenateVideos(videoPaths, outputPath) {
        const listPath = path.join(this.tempDir, 'concat_list.txt');
        const listContent = videoPaths.map(p => `file '${p.replace(/'/g, "\\'")}'`).join('\n');
        fs.writeFileSync(listPath, listContent);

        const command = [
            this.ffmpegPath,
            '-f', 'concat',
            '-safe', '0',
            '-i', `"${listPath}"`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-pix_fmt', 'yuv420p',
            '-y',
            `"${outputPath}"`
        ].join(' ');

        await this.execFFmpeg(command);
        fs.unlinkSync(listPath);
        return outputPath;
    }

    async generateLatestJson(topics, videoPath) {
        const dateStr = new Date().toISOString();
        const filename = path.basename(videoPath);
        
        const latest = {
            version: '1.0',
            generated_at: dateStr,
            video: {
                url: filename,
                filename: filename,
                duration: this.calculateDuration(topics),
                width: this.videoWidth,
                height: this.videoHeight
            },
            topics: topics.map(t => ({
                rank: t.rank,
                title: t.title,
                platform: t.platform,
                category: t.category,
                heat_score: t.heat_score,
                reason_short: t.reason_short,
                recommendation_voice: t.recommendation_voice,
                source_link: t.source_link,
                thumbnail: t.thumbnail
            })),
            total_topics: topics.length
        };

        const json = JSON.stringify(latest, null, 2);
        fs.writeFileSync('latest.json', json, 'utf-8');
        console.log('[VideoBuilder] Generated latest.json');
        return latest;
    }

    calculateDuration(topics) {
        return 3 + topics.length * 8 + 5;
    }

    async build(topics) {
        console.log('[VideoBuilder] Starting video build...');

        const videoPaths = [];

        videoPaths.push(await this.createIntroClip());

        for (const topic of topics) {
            console.log(`[VideoBuilder] Creating clip ${topic.rank}: ${topic.title.substring(0, 30)}...`);
            videoPaths.push(await this.createTopicClip(topic));
        }

        videoPaths.push(await this.createOutroClip());

        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const outputPath = path.join(this.outputDir, `GTVD_${dateStr}.mp4`);

        await this.concatenateVideos(videoPaths, outputPath);
        console.log(`[VideoBuilder] Video saved to ${outputPath}`);

        await this.generateLatestJson(topics, outputPath);

        this.cleanupTemp();

        return {
            videoPath: outputPath,
            topics: topics.length
        };
    }

    cleanupTemp() {
        try {
            fs.rmSync(this.tempDir, { recursive: true, force: true });
            fs.mkdirSync(this.tempDir, { recursive: true });
        } catch {
            console.warn('[VideoBuilder] Failed to cleanup temp directory');
        }
    }

    async loadFromFile(filename = 'ai-analysis-result.json') {
        if (!fs.existsSync(filename)) {
            throw new Error(`File not found: ${filename}`);
        }
        const content = fs.readFileSync(filename, 'utf-8');
        return JSON.parse(content);
    }
}

async function main() {
    const builder = new VideoBuilder();
    
    try {
        const topics = await builder.loadFromFile();
        await builder.build(topics);
        console.log('[VideoBuilder] Video build complete!');
    } catch (error) {
        console.error('[VideoBuilder] Fatal error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = VideoBuilder;
