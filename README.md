# GTVD 全球热点AI视频日报系统

> 全自动生成全球热点视频日报的完整解决方案

## 📋 项目概览

GTVD 是一个全自动系统，每天从全球各大平台（YouTube、TikTok、Twitter、Instagram）采集热点数据，通过 AI 分析筛选出 TOP10 最值得关注的热点话题，自动合成竖屏视频日报，并通过 H5 页面展示。

## 🏗️ 项目结构

```
gtvd-project/
├── .github/workflows/daily.yml    # 每日定时任务
├── .env.example                    # 环境变量配置示例
├── .cursorrules                    # 项目全局规则
├── gtvd-backend/                   # Node.js 后端
│   ├── data-fetcher.js            # 数据采集模块
│   ├── ai-analyzer.js             # AI分析与TOP10生成
│   ├── video-builder.js           # 视频合成流水线
│   ├── scheduler.js               # 定时任务入口
│   ├── test-workflow.js           # 测试脚本
│   └── package.json
└── gtvd-frontend/                  # Vue3 + Vant 前端
    ├── src/
    │   ├── views/Daily.vue        # 日报页面
    │   ├── App.vue
    │   ├── main.js
    │   └── styles/main.scss
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## 🚀 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- FFmpeg（视频合成）
- Python 3（edge-tts）

### 2. 安装依赖

```bash
# 后端
cd gtvd-backend
npm install

# 前端
cd gtvd-frontend
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件填入实际密钥
```

### 4. 运行测试

```bash
cd gtvd-backend
npm test
```

### 5. 手动执行完整流程

```bash
cd gtvd-backend
npm run daily
```

## 🔧 核心模块

### 数据采集 (data-fetcher.js)

- 通过 Bright Data 代理采集海外平台热点
- 支持 YouTube、TikTok、Twitter、Instagram
- 输出统一格式：`{title, platform, heat, url, thumbnail}`

### AI分析 (ai-analyzer.js)

- 调用 DeepSeek API 进行热点分析
- 自动分类、去重、生成推荐语
- 输出 TOP10 JSON

### 视频合成 (video-builder.js)

- FFmpeg 本地合成竖屏视频
- Edge TTS 语音合成
- Ken Burns 动态效果
- 生成 latest.json 清单

### 前端展示 (gtvd-frontend)

- Vue3 + Vant 移动端 H5
- 支持微信内全屏播放
- 适配 320px-428px 手机宽度

## ⏰ 定时任务

每天北京时间 08:00 自动执行：

1. 数据采集 → 2. AI分析 → 3. 视频合成 → 4. 部署发布

## 📦 环境变量配置

### 必需配置

| 变量 | 说明 |
|------|------|
| `AI_API_KEY` | DeepSeek API 密钥 |
| `AI_BASE_URL` | DeepSeek API 地址 |
| `AI_MODEL` | 模型名称 |
| `BRIGHTDATA_PROXY_HOST` | 代理主机 |
| `BRIGHTDATA_PROXY_PORT` | 代理端口 |
| `BRIGHTDATA_PROXY_USERNAME` | 代理用户名 |
| `BRIGHTDATA_PROXY_PASSWORD` | 代理密码 |

### 可选配置

| 变量 | 说明 |
|------|------|
| `WECHAT_WEBHOOK_URL` | 企业微信通知 |
| `FFMPEG_PATH` | FFmpeg 路径 |
| `VIDEO_WIDTH` | 视频宽度 |
| `VIDEO_HEIGHT` | 视频高度 |

## 📤 部署说明

### 前端部署

```bash
cd gtvd-frontend
npm run build
# 部署 dist 目录到 CDN 或 GitHub Pages
```

### GitHub Actions 配置

在仓库 Secrets 中添加：

- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- `BRIGHTDATA_PROXY_HOST`
- `BRIGHTDATA_PROXY_PORT`
- `BRIGHTDATA_PROXY_USERNAME`
- `BRIGHTDATA_PROXY_PASSWORD`
- `WECHAT_WEBHOOK_URL`（可选）

## 📝 等待补齐的 Key 清单

| 服务 | 状态 | 说明 |
|------|------|------|
| 阿里云 OSS | ❌ 缺失 | 视频存储 |
| 阿里云 TTS | ❌ 缺失 | 语音合成 |
| 国内热点API | ❌ 缺失 | 微博、抖音等 |
| 企业微信通知 | ❌ 缺失 | 失败报警 |

## 📈 当前可运行范围

- ✅ 数据采集（Bright Data）
- ✅ AI分析（DeepSeek）
- ✅ 视频合成（FFmpeg + Edge TTS）
- ✅ 前端展示（Vue3 + Vant）
- ✅ GitHub Actions 自动化

## 📜 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
