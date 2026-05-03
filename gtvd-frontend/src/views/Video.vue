<template>
  <div class="video-page">
    <div class="video-container" @click="toggleControls">
      <video
        ref="videoRef"
        :src="videoUrl"
        :poster="thumbnailUrl"
        controls
        playsinline
        webkit-playsinline
        x5-video-player-type="h5"
        x5-video-orientation="portrait"
        x5-video-player-fullscreen="true"
        @play="onVideoPlay"
        @pause="onVideoPause"
        @ended="onVideoEnded"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @error="onVideoError"
      ></video>

      <div v-if="showControls" class="video-controls">
        <div class="progress-bar" @click.stop="seekTo">
          <div class="progress-current" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="controls-bottom">
          <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
          <van-icon name="arrow-left" size="24" @click.stop="goBack" />
        </div>
      </div>

      <div v-if="loading" class="video-loading">
        <van-loading type="spinner" color="#fff" size="40px" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getLatestReport, getReportByDate } from '@/api'

const router = useRouter()
const route = useRoute()
const videoRef = ref(null)
const report = ref(null)
const loading = ref(true)
const showControls = ref(true)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const controlsTimer = ref(null)

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

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return (currentTime.value / duration.value) * 100
})

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const fetchReport = async () => {
  loading.value = true
  try {
    const date = route.params.id
    if (date) {
      report.value = await getReportByDate(date)
    } else {
      report.value = await getLatestReport()
    }
  } catch (error) {
    console.error('Failed to load video:', error)
  } finally {
    loading.value = false
  }
}

const toggleControls = () => {
  showControls.value = !showControls.value
  resetControlsTimer()
}

const resetControlsTimer = () => {
  if (controlsTimer.value) {
    clearTimeout(controlsTimer.value)
  }
  if (showControls.value) {
    controlsTimer.value = setTimeout(() => {
      if (isPlaying.value) {
        showControls.value = false
      }
    }, 3000)
  }
}

const seekTo = (event) => {
  const video = videoRef.value
  if (!video) return
  
  const rect = event.currentTarget.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  video.currentTime = percent * duration.value
}

const goBack = () => {
  router.back()
}

const onVideoPlay = () => {
  isPlaying.value = true
  resetControlsTimer()
}

const onVideoPause = () => {
  isPlaying.value = false
  showControls.value = true
}

const onVideoEnded = () => {
  isPlaying.value = false
  showControls.value = true
}

const onTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

const onLoadedMetadata = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

const onVideoError = (e) => {
  console.error('Video error:', e)
}

onMounted(() => {
  fetchReport()
})

onUnmounted(() => {
  if (controlsTimer.value) {
    clearTimeout(controlsTimer.value)
  }
})
</script>

<style lang="scss" scoped>
.video-page {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: #000;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}

.video-container {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
}

.video-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px;
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  transition: opacity 0.3s;

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    margin-bottom: 12px;
    cursor: pointer;

    .progress-current {
      height: 100%;
      background: #1989fa;
      border-radius: 2px;
      transition: width 0.1s linear;
    }
  }

  .controls-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #fff;
    font-size: 14px;
  }
}

.video-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
