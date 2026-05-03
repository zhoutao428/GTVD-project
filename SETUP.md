# GTVD 项目配置说明

## GitHub Actions Secrets 配置

在 GitHub 仓库设置中添加以下 Secrets：

### 数据源 API
| 变量名 | 说明 | 示例 |
|--------|------|------|
| `KEYAPI_KEY` | KeyAPI 密钥 | `your-keyapi-key-here` |
| `JUHE_API_KEY` | 聚合数据密钥 | `your-juhe-key-here` |
| `TIANXING_KEY` | 天行数据密钥（可选） | `your-tianxing-key-here` |

### AI 分析
| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | `sk-your-deepseek-key-here` |
| `TONGYI_API_KEY` | 通义千问 API 密钥（可选） | `sk-your-tongyi-key-here` |

### OSS/CDN
| 变量名 | 说明 | 示例 |
|--------|------|------|
| `OSS_ENDPOINT` | OSS 端点 | `oss-cn-hangzhou.aliyuncs.com` |
| `OSS_BUCKET` | OSS Bucket 名称 | `gtvd-static` |
| `OSS_ACCESS_KEY_ID` | OSS 访问密钥 ID | `LTAI5tYourKeyId` |
| `OSS_ACCESS_KEY_SECRET` | OSS 访问密钥 Secret | `YourSecretHere` |
| `CDN_BASE_URL` | CDN 基础 URL | `https://cdn.yourdomain.com` |
| `CDN_REFRESH_URL` | CDN 刷新 API 地址（可选） | `https://cdn-api.aliyun.com/refresh` |
| `CDN_AUTH_TOKEN` | CDN 刷新认证 Token（可选） | `your-cdn-auth-token` |

### 通知
| 变量名 | 说明 | 示例 |
|--------|------|------|
| `WECHAT_WEBHOOK_URL` | 企业微信群机器人 Webhook 地址 | `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxx` |

## 工作流程说明

### 自动执行（每日）
- **触发时间**：北京时间每日 08:00（UTC 00:00）
- **流程**：
  1. 发送开始通知到企业微信群
  2. 运行 `data-fetcher.js` 采集多平台热点
  3. 运行 `ai-analyzer.js` 进行 AI 分析和分类
  4. 运行 `video-builder.js` 合成视频
  5. 上传到 OSS 并刷新 CDN
  6. 发送成功/失败通知

### 手动执行
在 GitHub Actions 页面选择 `GTVD Daily Automation`，然后点击 `Run workflow`，选择运行模式：
- `full`：完整流程（推荐）
- `fetch`：仅数据采集
- `analyze`：仅 AI 分析
- `build`：仅视频生成

## 本地开发流程

```bash
# 1. 配置环境变量
cp gtvd-backend/.env.example gtvd-backend/.env
# 编辑 .env 填入密钥

# 2. 安装依赖
cd gtvd-backend && npm install
cd ../gtvd-frontend && npm install

# 3. 数据采集
cd gtvd-backend && npm run fetcher

# 4. AI 分析
npm run analyzer

# 5. 视频合成
npm run build:video

# 6. 前端预览
cd ../gtvd-frontend && npm run dev
```

## 项目结构

```
GTVD-project/
├── .github/
│   └── workflows/
│       ├── daily.yml         # 每日自动化工作流
│       └── daily-workflow.yml # 旧版工作流
├── gtvd-backend/
│   ├── data-fetcher.js       # 数据采集
│   ├── ai-analyzer.js        # AI 分析
│   ├── video-builder.js      # 视频合成
│   └── package.json
└── gtvd-frontend/
    ├── src/views/Daily.vue   # 日报页面
    ├── package.json
    └── vite.config.js
```

## 注意事项

1. **企业微信群机器人**：请确保 Webhook 地址正确，机器人已加入对应群组
2. **OSS 权限**：访问密钥需要有上传权限
3. **FFmpeg**：视频合成需要 FFmpeg 支持（GitHub Actions 已预置）
4. **CDN 刷新**：可选功能，如不配置则跳过刷新步骤
5. **AI API**：DeepSeek 为主要 API，通义千问为备用
