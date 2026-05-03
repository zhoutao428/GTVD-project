<template>
  <div class="daily-page">
    <div class="nav-header">
      <span class="nav-title">🌍 GTVD 全球热点AI日报</span>
    </div>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh" class="content">
      <div v-if="loading && !manifest" class="loading-container">
        <van-loading type="spinner" color="#1989fa" size="40px">加载中...</van-loading>
      </div>

      <div v-else-if="error && !manifest" class="error-container">
        <div class="error-icon">😵</div>
        <div class="error-message">{{ error }}</div>
        <van-button type="primary" size="small" @click="fetchManifest">重试</van-button>
      </div>

      <template v-else-if="manifest">
        <div class="video-section">
          <div class="video-date">{{ formatDate(manifest.generated_at) }}</div>
          <div class="video-container">
            <video
              ref="videoRef"
              class="video-player"
              :src="manifest.video.url"
              :poster="manifest.video.poster || ''"
              controls
              playsinline
              webkit-playsinline
              x5-video-player-type="h5"
              x5-video-player-fullscreen="true"
              @play="onVideoPlay"
              @pause="onVideoPause"
              @ended="onVideoEnded"
              @error="onVideoError"
            ></video>
          </div>
          <div class="video-info">
            <span class="video-duration">{{ formatDuration(manifest.video.duration) }}</span>
            <span class="video-topics">{{ manifest.total_topics }} 个热点</span>
          </div>
        </div>

        <div class="topics-section">
          <div class="section-header">
            <span class="section-title">🔥 热点话题</span>
            <span class="section-count">{{ manifest.topics.length }}</span>
          </div>

          <div class="topics-list">
            <div
              v-for="topic in manifest.topics"
              :key="topic.rank"
              class="topic-card"
              @click="onTopicClick(topic)"
            >
              <div class="topic-rank" :class="getRankClass(topic.rank)">
                {{ topic.rank }}
              </div>
              <div class="topic-content">
                <div class="topic-category">{{ topic.category }}</div>
                <div class="topic-title">{{ topic.title }}</div>
                <div class="topic-recommendation">{{ topic.recommendation_voice }}</div>
                <div class="topic-meta">
                  <span class="topic-heat">
                    <van-icon name="fire" />
                    {{ topic.heat_score }}
                  </span>
                  <span class="topic-platform">{{ topic.platform }}</span>
                </div>
              </div>
              <div class="topic-arrow">
                <van-icon name="arrow" />
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="empty-container">
        <van-empty description="暂无数据" />
      </div>
    </van-pull-refresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showToast } from 'vant';

const manifest = ref(null);
const loading = ref(false);
const refreshing = ref(false);
const error = ref(null);
const videoRef = ref(null);

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
};

const formatDuration = (seconds) => {
  if (!seconds) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const getRankClass = (rank) => {
  if (rank === 1) return 'rank-gold';
  if (rank === 2) return 'rank-silver';
  if (rank === 3) return 'rank-bronze';
  return '';
};

const fetchManifest = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch('latest.json');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    manifest.value = data;
  } catch (err) {
    console.error('[Daily] Fetch manifest error:', err);
    error.value = '加载数据失败，请检查网络';
  } finally {
    loading.value = false;
  }
};

const onRefresh = async () => {
  refreshing.value = true;
  await fetchManifest();
  refreshing.value = false;
  if (manifest.value) {
    showToast('刷新成功');
  }
};

const onVideoPlay = () => {
  console.log('[Daily] Video playing');
};

const onVideoPause = () => {
  console.log('[Daily] Video paused');
};

const onVideoEnded = () => {
  console.log('[Daily] Video ended');
};

const onVideoError = (e) => {
  console.error('[Daily] Video error:', e);
  showToast('视频播放失败');
};

const onTopicClick = (topic) => {
  showToast(`话题 #${topic.rank}: ${topic.title}`);
};

onMounted(() => {
  fetchManifest();
});
</script>

<style lang="scss" scoped>
.daily-page {
  width: 100%;
  min-height: 100vh;
  background: #f7f8fa;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-title {
  font-size: 18px;
  font-weight: 600;
}

.content {
  min-height: calc(100vh - 60px);
}

.loading-container,
.error-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 40px 20px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-message {
  color: #969799;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.video-section {
  background: white;
  margin: 12px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.video-date {
  padding: 12px 16px;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid #f7f8fa;
}

.video-container {
  position: relative;
  width: 100%;
  padding-top: 177.78%;
  background: #000;
}

.video-player {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-info {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 13px;
  color: #969799;
  background: #fafafa;
}

.video-duration,
.video-topics {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topics-section {
  background: white;
  margin: 12px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f7f8fa;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.section-count {
  font-size: 12px;
  color: #969799;
  background: #f7f8fa;
  padding: 2px 8px;
  border-radius: 10px;
}

.topics-list {
  padding: 0;
}

.topic-card {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f7f8fa;
  cursor: pointer;
  transition: background-color 0.2s;

  &:active {
    background-color: #f7f8fa;
  }

  &:last-child {
    border-bottom: none;
  }
}

.topic-rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e8e8e8;
  color: #666;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;

  &.rank-gold {
    background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);
    color: white;
  }

  &.rank-silver {
    background: linear-gradient(135deg, #c0c0c0 0%, #a0a0a0 100%);
    color: white;
  }

  &.rank-bronze {
    background: linear-gradient(135deg, #cd7f32 0%, #b8860b 100%);
    color: white;
  }
}

.topic-content {
  flex: 1;
  min-width: 0;
}

.topic-category {
  font-size: 11px;
  color: #1989fa;
  background: rgba(25, 137, 250, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 4px;
}

.topic-title {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  line-height: 1.4;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-recommendation {
  font-size: 12px;
  color: #969799;
  line-height: 1.4;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #c8c9cc;
}

.topic-heat {
  display: flex;
  align-items: center;
  gap: 2px;
  color: #ee0a24;
}

.topic-platform {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-arrow {
  color: #c8c9cc;
  margin-left: 8px;
  flex-shrink: 0;
}

@media screen and (max-width: 360px) {
  .topic-title {
    font-size: 14px;
  }

  .topic-recommendation {
    font-size: 11px;
  }
}

@media screen and (min-width: 376px) and (max-width: 428px) {
  .video-section,
  .topics-section {
    margin: 14px;
  }
}
</style>
