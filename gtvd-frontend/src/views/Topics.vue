<template>
  <div class="container">
    <div class="header">
      <div class="header-title">📋 Today's Hot Topics</div>
    </div>

    <div class="page">
      <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
        <div v-if="loading && !topics.length" class="loading-container">
          <van-loading type="spinner" color="#1989fa" size="40px">Loading...</van-loading>
        </div>

        <div v-else-if="error && !topics.length" class="empty-container">
          <div class="empty-icon">😵</div>
          <div class="empty-text">{{ error }}</div>
          <van-button type="primary" size="small" style="margin-top: 16px" @click="fetchTopics">
            Retry
          </van-button>
        </div>

        <div v-else class="topics-list">
          <div class="topics-date">{{ formatDate(selectedDate) }}</div>
          
          <van-tabs v-model:active="activeTab" sticky>
            <van-tab title="All" name="all"></van-tab>
            <van-tab title="AI" name="ai"></van-tab>
            <van-tab title="Tech" name="tech"></van-tab>
            <van-tab title="Hot" name="hot"></van-tab>
          </van-tabs>

          <div class="topics-content">
            <div
              v-for="(topic, index) in filteredTopics"
              :key="topic.id"
              class="topic-card"
            >
              <div class="topic-card-header">
                <div :class="['topic-rank', { top: index < 3 }]">{{ index + 1 }}</div>
                <div class="topic-category" v-if="topic.category">
                  {{ topic.category.toUpperCase() }}
                </div>
              </div>
              
              <div class="topic-card-body">
                <h3 class="topic-title">{{ topic.title }}</h3>
                <p v-if="topic.summary" class="topic-summary">{{ topic.summary }}</p>
              </div>

              <div class="topic-card-footer">
                <span class="topic-source">
                  <van-icon name="location-o" size="14" />
                  {{ topic.source }}
                </span>
                <span class="topic-heat" v-if="topic.heat_index">
                  🔥 {{ formatHeatIndex(topic.heat_index) }}
                </span>
                <span class="topic-status" :class="{ processed: topic.is_processed }">
                  {{ topic.is_processed ? 'Processed' : 'Pending' }}
                </span>
              </div>
            </div>

            <div v-if="!filteredTopics.length" class="empty-container">
              <div class="empty-icon">📭</div>
              <div class="empty-text">No topics found</div>
            </div>
          </div>
        </div>
      </van-pull-refresh>
    </div>

    <div class="footer">
      <router-link to="/" class="footer-item">
        <span class="icon">🏠</span>
        <span>Home</span>
      </router-link>
      <router-link to="/topics" class="footer-item active">
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
import { getTopics } from '@/api'
import dayjs from 'dayjs'

const topics = ref([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref(null)
const activeTab = ref('all')
const selectedDate = ref(dayjs().format('YYYY-MM-DD'))

const filteredTopics = computed(() => {
  if (activeTab.value === 'all') {
    return topics.value
  }
  return topics.value.filter(t => t.category === activeTab.value)
})

const formatDate = (dateStr) => {
  return dayjs(dateStr).format('YYYY-MM-DD')
}

const formatHeatIndex = (value) => {
  if (!value) return '0'
  if (value >= 10000) return (value / 10000).toFixed(1) + 'w'
  if (value >= 1000) return (value / 1000).toFixed(1) + 'k'
  return value
}

const fetchTopics = async () => {
  error.value = null
  try {
    const data = await getTopics(selectedDate.value)
    topics.value = data.topics || []
  } catch (err) {
    error.value = err.message || 'Failed to load topics'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const onRefresh = () => {
  fetchTopics()
}

onMounted(() => {
  fetchTopics()
})
</script>

<style lang="scss" scoped>
.topics-date {
  font-size: 14px;
  color: #969799;
  margin-bottom: 12px;
  text-align: center;
}

.topics-content {
  margin-top: 16px;
}

.topic-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  &-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
  }

  &-body {
    margin-bottom: 12px;
  }

  &-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: #969799;
  }
}

.topic-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  margin-right: 8px;

  &.top {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
}

.topic-category {
  font-size: 10px;
  font-weight: 600;
  color: #1989fa;
  background: rgba(25, 137, 250, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.topic-title {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  line-height: 1.4;
  margin-bottom: 8px;
}

.topic-summary {
  font-size: 13px;
  color: #646566;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.topic-source {
  display: flex;
  align-items: center;
  gap: 4px;
}

.topic-heat {
  flex: 1;
}

.topic-status {
  padding: 2px 6px;
  border-radius: 4px;
  background: #ebedf0;
  color: #646566;

  &.processed {
    background: rgba(25, 137, 250, 0.1);
    color: #1989fa;
  }
}
</style>
