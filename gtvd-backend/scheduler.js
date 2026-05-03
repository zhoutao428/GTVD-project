require('dotenv').config();
const schedule = require('node-schedule');
const { exec } = require('child_process');

class Scheduler {
    constructor() {
        this.wechatWebhookUrl = process.env.WECHAT_WEBHOOK_URL;
        this.job = null;
    }

    async sendWechatNotification(title, content, type = 'info') {
        if (!this.wechatWebhookUrl) {
            console.log('[Scheduler] WECHAT_WEBHOOK_URL not configured, skipping notification');
            return;
        }

        try {
            const axios = require('axios');
            const payload = {
                msgtype: 'markdown',
                markdown: {
                    content: `### ${type === 'error' ? '❌' : '✅'} ${title}\n\n${content}`
                }
            };

            await axios.post(this.wechatWebhookUrl, payload);
            console.log('[Scheduler] WeChat notification sent');
        } catch (error) {
            console.error('[Scheduler] Failed to send WeChat notification:', error.message);
        }
    }

    async runDailyWorkflow() {
        console.log('[Scheduler] Starting daily workflow at', new Date().toLocaleString('zh-CN'));
        await this.sendWechatNotification('GTVD 日报任务开始', `**时间**: ${new Date().toLocaleString('zh-CN')}`);

        try {
            await this.executeStep('数据采集', 'node data-fetcher.js');
            await this.executeStep('AI分析', 'node ai-analyzer.js');
            await this.executeStep('视频合成', 'node video-builder.js');

            await this.sendWechatNotification('GTVD 日报任务成功', '数据采集、AI分析、视频合成都已完成！');
            console.log('[Scheduler] Daily workflow completed successfully');
        } catch (error) {
            await this.sendWechatNotification('GTVD 日报任务失败', `**错误**: ${error.message}`);
            console.error('[Scheduler] Daily workflow failed:', error.message);
        }
    }

    executeStep(stepName, command) {
        return new Promise((resolve, reject) => {
            console.log(`[Scheduler] Executing step: ${stepName}`);
            
            const process = exec(command, { 
                cwd: __dirname,
                timeout: 600000 
            });

            process.stdout.on('data', (data) => {
                console.log(`[${stepName}] ${data.trim()}`);
            });

            process.stderr.on('data', (data) => {
                console.warn(`[${stepName}] ${data.trim()}`);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    console.log(`[Scheduler] Step ${stepName} completed successfully`);
                    resolve();
                } else {
                    reject(new Error(`Step ${stepName} failed with exit code ${code}`));
                }
            });
        });
    }

    start() {
        const cronTime = process.env.GENERATE_CRON || '0 8 * * *';
        console.log(`[Scheduler] Scheduling daily job at ${cronTime} (UTC)`);

        this.job = schedule.scheduleJob(cronTime, () => {
            this.runDailyWorkflow();
        });

        console.log('[Scheduler] Scheduler started');
    }

    stop() {
        if (this.job) {
            this.job.cancel();
            console.log('[Scheduler] Scheduler stopped');
        }
    }

    async runOnce() {
        await this.runDailyWorkflow();
    }
}

async function main() {
    const scheduler = new Scheduler();

    if (process.argv.includes('--run')) {
        await scheduler.runOnce();
        process.exit(0);
    }

    scheduler.start();
}

if (require.main === module) {
    main().catch(error => {
        console.error('[Scheduler] Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = Scheduler;
