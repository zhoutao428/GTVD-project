require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

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
            const child = spawn(command, [], { 
                shell: true,
                timeout: 300000 
            });
            
            let stderr = '';
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`FFmpeg error: Exit code ${code}\n${stderr}`));
                }
            });
            
            child.on('error', (error) => {
                reject(new Error(`FFmpeg error: ${error.message}`));
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
            '-i', `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=3`,
            '-vf', `drawtext=text='🌍 GTVD 全球热点AI日报':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-100:enable='between(t,0,3)',drawtext=text='${dateStr}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+50:enable='between(t,0,3)'`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            introPath
        ].join(' ');

        await this.execFFmpeg(command);
        return introPath;
    }

    async createOutroClip() {
        const outroPath = path.join(this.tempDir, `outro.mp4`);
        
        const command = [
            this.ffmpegPath,
            '-f', 'lavfi',
            '-i', `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=5`,
            '-vf', `drawtext=text='感谢观看':fontsize=52:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-30:enable='between(t,0,5)',drawtext=text='明天再见！':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+50:enable='between(t,0,5)'`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            outroPath
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
            const command = `edge-tts --voice ${this.edgeTtsVoice} --text "${safeText}" --write-media ${outputPath}`;

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
                    '-i', thumbnailPath,
                    '-i', audioPath,
                    '-t', String(duration),
                    '-vf', `"zoompan=z='min(zoom+0.005,1.2)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${this.videoWidth}x${this.videoHeight},scale=${this.videoWidth}:${this.videoHeight}:force_original_aspect_ratio=decrease,pad=${this.videoWidth}:${this.videoHeight}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${topic.category}':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=20:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=40:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=${this.videoHeight - 80}:enable='between(t,0,${duration})'`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-shortest',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    clipPath
                ].join(' ');
            } else {
                command = [
                    this.ffmpegPath,
                    '-loop', '1',
                    '-i', thumbnailPath,
                    '-t', String(duration),
                    '-vf', `"zoompan=z='min(zoom+0.005,1.2)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${this.videoWidth}x${this.videoHeight},scale=${this.videoWidth}:${this.videoHeight}:force_original_aspect_ratio=decrease,pad=${this.videoWidth}:${this.videoHeight}:(ow-iw)/2:(oh-ih)/2:black,drawtext=text='${topic.category}':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=20:y=20:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=40:fontcolor=white:boxcolor=black@0.7:boxborderw=10:x=20:y=${this.videoHeight - 80}:enable='between(t,0,${duration})'`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    clipPath
                ].join(' ');
            }
        } else {
            if (hasAudio) {
                command = [
                    this.ffmpegPath,
                    '-f', 'lavfi',
                    `-i`, `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=${duration}`,
                    '-i', audioPath,
                    '-vf', `"drawtext=text='${topic.category}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-80:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+30:enable='between(t,0,${duration})'`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-shortest',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    clipPath
                ].join(' ');
            } else {
                command = [
                    this.ffmpegPath,
                    '-f', 'lavfi',
                    `-i`, `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=${duration}`,
                    '-vf', `"drawtext=text='${topic.category}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-80:enable='between(t,0,${duration})',drawtext=text='${topic.title}':fontsize=36:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2+30:enable='between(t,0,${duration})'`,
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-y',
                    clipPath
                ].join(' ');
            }
        }

        await this.execFFmpeg(command);
        return clipPath;
    }

    async downloadFile(url, outputPath) {
        const axios = require('axios');
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        
        return new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    async concatVideos(videoPaths, outputPath) {
        const concatListPath = path.join(this.tempDir, 'concat_list.txt');
        const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
        fs.writeFileSync(concatListPath, listContent);

        const command = [
            this.ffmpegPath,
            '-f', 'concat',
            '-safe', '0',
            '-i', concatListPath,
            '-c', 'copy',
            '-y',
            outputPath
        ].join(' ');

        await this.execFFmpeg(command);
        return outputPath;
    }

    async buildVideo(topics) {
        console.log('[VideoBuilder] Starting video build...');

        const videoPaths = [];

        const introPath = await this.createIntroClip();
        videoPaths.push(introPath);

        for (let i = 0; i < topics.length; i++) {
            const topicPath = await this.createTopicClip(topics[i], i + 1);
            videoPaths.push(topicPath);
        }

        const outroPath = await this.createOutroClip();
        videoPaths.push(outroPath);

        const outputPath = path.join(this.outputDir, `daily_${new Date().toISOString().split('T')[0]}.mp4`);
        await this.concatVideos(videoPaths, outputPath);

        console.log(`[VideoBuilder] Video generated: ${outputPath}`);

        this.saveLatestManifest(topics, outputPath);

        return outputPath;
    }

    saveLatestManifest(topics, videoPath) {
        const manifest = {
            date: new Date().toISOString().split('T')[0],
            video_url: `/videos/${path.basename(videoPath)}`,
            video_path: videoPath,
            topics: topics.map(t => ({
                rank: t.rank,
                title: t.title,
                category: t.category,
                heat_score: t.heat_score,
                thumbnail: t.thumbnail,
                url: t.url
            }))
        };

        const manifestPath = path.join(this.outputDir, '..', 'latest.json');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`[VideoBuilder] Manifest saved: ${manifestPath}`);
    }
}

async function main() {
    const dataPath = './data-fetcher.json';
    const analyzerPath = './ai-analysis-result.json';

    if (!fs.existsSync(dataPath)) {
        console.error('[VideoBuilder] Data file not found:', dataPath);
        process.exit(1);
    }

    if (!fs.existsSync(analyzerPath)) {
        console.error('[VideoBuilder] Analysis file not found:', analyzerPath);
        process.exit(1);
    }

    const topics = JSON.parse(fs.readFileSync(analyzerPath, 'utf8'));
    
    if (!Array.isArray(topics) || topics.length === 0) {
        console.error('[VideoBuilder] No topics found in analysis file');
        process.exit(1);
    }

    const builder = new VideoBuilder();
    await builder.buildVideo(topics);
}

if (require.main === module) {
    main().catch(error => {
        console.error('[VideoBuilder] Fatal error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    });
}

module.exports = VideoBuilder;
