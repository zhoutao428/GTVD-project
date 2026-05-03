<template>
  <div class="container">
    <div class="header">
      <div class="header-title">🌍 GTVD 全球热点AI日报</div>
    </div>

    <div class="page">
      <div v-if="loading" class="loading-container">
        <van-loading type="spinner" color="#1989fa" size="40px">Loading...</van-loading>
      </div>

      <div v-else-if="error" class="empty-container">
        <div class="empty-icon">😵</div>
        <div class="empty-text">{{ error }}</div>
        <van-button type="primary" size="small" style="margin-top: 16px" @click="fetchData">
          Retry
        </van-button>
      </div>

      <template v-else-if="report">
        <div class="video-section">
          <div class="video-date">{{ formatDate(report.report_date) }}</div>
          <div class="video-card">
            <video
              ref="videoRef"
              :src="videoUrl"
              :poster="thumbnailUrl"
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
            <div class="video-title">{{ report.title }}</div>
            <div class="video-meta">
              <span>{{ report.topic_count }} Topics</span>
              <span v-if="report.duration">{{ formatDuration(report.duration) }}</span>
            </div>
          </div>
        </div>

        <div class="topics-section">
          <div class="section-title">
            <span>📰</span> Today's Hot Topics
          </div>
          <div class="topics-list">
            <div
              v-for="(topic, index) in report.topics"
              :key="topic.id"
              class="topic-item"
              @click="scrollToTopic(topic)"
            >
              <div :class="['topic-rank', { top: index < 3 }]">{{ index + 1 }}</div>
              <div class="topic-content">
                <div class="topic-title">{{ topic.clean_title || topic.title }}</div>
                <div v-if="topic.clean_summary" class="topic-summary">{{ topic.clean_summary }}</div>
                <div class="topic-meta">
                  <span class="topic-source">{{ topic.category || 'General' }}</span>
                  <span class="topic-quality" v-if="topic.quality_score">
                    Quality: {{ topic.quality_score }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="empty-container">
        <div class="empty-icon">📺</div>
        <div class="empty-text">No report available yet</div>
        <van-button type="primary" size="small" style="margin-top: 16px" @click="fetchData">
          Refresh
        </van-button>
      </div>
    </div>

    <div class="footer">
      <router-link to="/" class="footer-item active">
        <span class="icon">🏠</span>
        <span>Home</span>
      </router-link>
      <router-link to="/topics" class="footer-item">
        <span class="icon">📋</span>
        <span>Topics</span>
      </router-link>
      <router-link to="/about" class="footer-item">
        <span class="icon">ℹ️</span>
        <span>About</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getLatestReport } from '@/api'
import dayjs from 'dayjs'

const router = useRouter()
const videoRef = ref(null)
const report = ref(null)
const loading = ref(true)
const error = ref(null)
const isPlaying = ref(false)

const videoUrl = computed(() => {
  if (!report.value?.video_url) return ''
  return report.value.video_url.startsWith('http')
    ? report.value.video_url
    : `${import.meta.env.VITE_API_BASE || ''}${report.value.video_url}`
})

const thumbnailUrl = computed(() => {
  if (!report.value?.thumbnail_url) return ''
  return report.value.thumbnail_url.startsWith('http')
    ? report.value.thumbnail_url
    : `${import.meta.env.VITE_API_BASE || ''}${report.value.thumbnail_url}`
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = dayjs(dateStr)
  return date.format('YYYY-MM-DD')
}

const formatDuration = (seconds) => {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const fetchData = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await getLatestReport()
    report.value = data
  } catch (err) {
    error.value = err.message || 'Failed to load report'
  } finally {
    loading.value = false
  }
}

const onVideoPlay = () => {
  isPlaying.value = true
}

const onVideoPause = () => {
  isPlaying.value = false
}

const onVideoEnded = () => {
  isPlaying.value = false
}

const onVideoError = (e) => {
  console.error('Video error:', e)
}

const scrollToTopic = (topic) => {
  console.log('Topic clicked:', topic)
}

onMounted(() => {
  fetchData()
})
</script>

<style lang="scss" scoped>
.video-section {
  margin-bottom: 24px;
}

.video-date {
  font-size: 13px;
  color: #969799;
  margin-bottom: 8px;
  text-align: center;
}

.video-info {
  margin-top: 12px;
}

.video-title {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 6px;
}

.video-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #969799;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #1989fa;

  span {
    margin-right: 8px;
  }
}

.topics-list {
  background: #fff;
  border-radius: 8px;
  padding: 0 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
</style>
