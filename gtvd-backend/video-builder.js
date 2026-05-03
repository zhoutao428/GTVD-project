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
        
        this.outputDir = process.env.VIDEO_OUTPUT_DIR || './output/videos';
        this.tempDir = process.env.TEMP_DIR || './temp';
        
        this.edgeTtsEnabled = process.env.EDGE_TTS_ENABLED === 'true';
        this.edgeTtsVoice = process.env.EDGE_TTS_VOICE || 'zh-CN-XiaoxiaoNeural';
        
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    execFFmpegArgs(args) {
        return new Promise((resolve, reject) => {
            const child = spawn(this.ffmpegPath, args, { timeout: 600000 });
            
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
        
        const args = [
            '-f', 'lavfi',
            '-i', `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=3`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            introPath
        ];

        await this.execFFmpegArgs(args);
        return introPath;
    }

    async createOutroClip() {
        const outroPath = path.join(this.tempDir, `outro.mp4`);
        
        const args = [
            '-f', 'lavfi',
            '-i', `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=5`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            outroPath
        ];

        await this.execFFmpegArgs(args);
        return outroPath;
    }

    async createTopicClip(topic, index) {
        const clipPath = path.join(this.tempDir, `clip_${topic.rank}.mp4`);
        const duration = 8;

        const hasThumbnail = topic.thumbnail && topic.thumbnail.startsWith('http');

        let args;
        if (hasThumbnail) {
            const thumbnailPath = path.join(this.tempDir, `thumb_${topic.rank}.jpg`);
            await this.downloadFile(topic.thumbnail, thumbnailPath);

            args = [
                '-loop', '1',
                '-i', thumbnailPath,
                '-t', String(duration),
                '-vf', `scale=${this.videoWidth}:${this.videoHeight}:force_original_aspect_ratio=decrease,pad=${this.videoWidth}:${this.videoHeight}:(ow-iw)/2:(oh-ih)/2:black`,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-y',
                clipPath
            ];
        } else {
            args = [
                '-f', 'lavfi',
                '-i', `color=c=black:s=${this.videoWidth}x${this.videoHeight}:d=${duration}`,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-y',
                clipPath
            ];
        }

        await this.execFFmpegArgs(args);
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
        const listContent = videoPaths.map(p => `file '${p.replace(/'/g, "\\'")}'`).join('\n');
        fs.writeFileSync(concatListPath, listContent);

        const args = [
            '-f', 'concat',
            '-safe', '0',
            '-i', concatListPath,
            '-c', 'copy',
            '-y',
            outputPath
        ];

        await this.execFFmpegArgs(args);
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
            video_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4',
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
        
        const frontendManifestPath = path.join(__dirname, '..', 'gtvd-frontend', 'public', 'latest.json');
        fs.writeFileSync(frontendManifestPath, JSON.stringify(manifest, null, 2));
        console.log(`[VideoBuilder] Frontend manifest saved: ${frontendManifestPath}`);
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
