<template>
  <div class="container">
    <div class="header">
      <div class="header-title">ℹ️ About</div>
    </div>

    <div class="page">
      <div class="about-section">
        <div class="app-info">
          <div class="app-logo">🌍</div>
          <h1 class="app-name">GTVD</h1>
          <p class="app-subtitle">Global Hotspot AI Video Daily Report</p>
          <p class="app-version">Version 1.0.0</p>
        </div>

        <div class="card">
          <h3 class="card-title">📖 Project Introduction</h3>
          <p class="card-text">
            GTVD is a fully automated system that generates daily video reports covering the world's top 10 hotspot events. 
            The system focuses on AI领域最新进展, trending content from major global platforms, and impactful international events.
          </p>
        </div>

        <div class="card">
          <h3 class="card-title">⚙️ Technical Architecture</h3>
          <div class="tech-list">
            <div class="tech-item">
              <span class="tech-icon">🎨</span>
              <div class="tech-info">
                <div class="tech-name">Frontend</div>
                <div class="tech-desc">Vue3 + Vant Mobile H5</div>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">⚡</span>
              <div class="tech-info">
                <div class="tech-name">Backend</div>
                <div class="tech-desc">Node.js + Express API</div>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">🗄️</span>
              <div class="tech-info">
                <div class="tech-name">Database</div>
                <div class="tech-desc">SQLite 3</div>
              </div>
            </div>
            <div class="tech-item">
              <span class="tech-icon">🎬</span>
              <div class="tech-info">
                <div class="tech-name">Video</div>
                <div class="tech-desc">FFmpeg Automated Generation</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">📊 Data Sources</h3>
          <div class="source-list">
            <div class="source-item">
              <van-icon name="check-circle" color="#07c160" />
              <span>KeyAPI - 国内合规数据服务</span>
            </div>
            <div class="source-item">
              <van-icon name="check-circle" color="#07c160" />
              <span>聚合数据 - 全球数据聚合API</span>
            </div>
            <div class="source-item">
              <van-icon name="check-circle" color="#07c160" />
              <span>百度/微博 - 公开热点数据</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">✨ Features</h3>
          <div class="feature-grid">
            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <div class="feature-text">No Login Required</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📱</div>
              <div class="feature-text">Mobile Optimized</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🚀</div>
              <div class="feature-text">Fast Loading</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔄</div>
              <div class="feature-text">Daily Auto Update</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">📈 System Status</h3>
          <div v-if="stats" class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ stats.today_topics_count || 0 }}</div>
              <div class="stat-label">Today's Topics</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ stats.latest_report?.topic_count || 0 }}</div>
              <div class="stat-label">Report Topics</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatUptime(stats.system_uptime) }}</div>
              <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">
                <van-tag :type="stats.latest_report?.video_ready ? 'success' : 'warning'">
                  {{ stats.latest_report?.video_ready ? 'Ready' : 'Generating' }}
                </van-tag>
              </div>
              <div class="stat-label">Video Status</div>
            </div>
          </div>
          <div v-else class="loading-container">
            <van-loading type="spinner" color="#1989fa" size="24px" />
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">⚠️ Disclaimer</h3>
          <p class="card-text small">
            本系统仅用于信息聚合展示，所有内容均来自公开数据源。
            本系统不对内容的真实性、准确性负责，也不承担任何法律责任。
            如有侵权请联系删除。
          </p>
        </div>
      </div>
    </div>

    <div class="footer">
      <router-link to="/" class="footer-item">
        <span class="icon">🏠</span>
        <span>Home</span>
      </router-link>
      <router-link to="/topics" class="footer-item">
        <span class="icon">📋</span>
        <span>Topics</span>
      </router-link>
      <router-link to="/about" class="footer-item active">
        <span class="icon">ℹ️</span>
        <span>About</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getStats } from '@/api'

const stats = ref(null)

const formatUptime = (seconds) => {
  if (!seconds) return '0h'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hours > 24) {
    return Math.floor(hours / 24) + 'd'
  }
  return hours + 'h ' + mins + 'm'
}

const fetchStats = async () => {
  try {
    stats.value = await getStats()
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style lang="scss" scoped>
.about-section {
  max-width: 100%;
}

.app-info {
  text-align: center;
  padding: 32px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  margin-bottom: 20px;
  color: #fff;
}

.app-logo {
  font-size: 64px;
  margin-bottom: 12px;
}

.app-name {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.app-subtitle {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.app-version {
  font-size: 12px;
  opacity: 0.7;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  &-title {
    font-size: 15px;
    font-weight: 600;
    color: #323233;
    margin-bottom: 12px;
  }

  &-text {
    font-size: 13px;
    color: #646566;
    line-height: 1.6;

    &.small {
      font-size: 12px;
      color: #969799;
    }
  }
}

.tech-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tech-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tech-icon {
  font-size: 24px;
}

.tech-name {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
}

.tech-desc {
  font-size: 12px;
  color: #969799;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.source-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #646566;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.feature-item {
  text-align: center;
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.feature-text {
  font-size: 12px;
  color: #646566;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #1989fa;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}
</style>
