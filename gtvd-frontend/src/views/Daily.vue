<template>
  <div class="daily-page">
    <div class="nav-header">
      <span class="nav-title">🌍 GTVD 热点搜索</span>
    </div>

    <div class="search-section">
      <van-field
        v-model="searchKeyword"
        placeholder="输入关键词搜索..."
        :clearable="true"
        :left-icon="'search'"
        @keyup.enter="onSearch"
        class="search-input"
      />
      <van-button type="primary" size="large" @click="onSearch" :loading="searching">
        搜索
      </van-button>
    </div>

    <div v-if="searching" class="loading-container">
      <van-loading type="spinner" color="#1989fa" size="40px">搜索中...</van-loading>
    </div>

    <div v-else-if="searchError" class="error-container">
      <div class="error-icon">😵</div>
      <div class="error-message">{{ searchError }}</div>
      <van-button type="primary" size="small" @click="onSearch">重试</van-button>
    </div>

    <div v-else-if="results.length > 0" class="results-section">
      <div class="section-header">
        <span class="section-title">🔍 搜索结果</span>
        <span class="section-count">{{ results.length }} 个</span>
      </div>

      <div class="topics-list">
        <div
          v-for="(item, index) in results"
          :key="index"
          class="topic-card"
          @click="onTopicClick(item)"
        >
          <div class="topic-rank" :class="getRankClass(index + 1)">
            {{ index + 1 }}
          </div>
          <div class="topic-content">
            <div class="topic-category">{{ item.category || '热点' }}</div>
            <div class="topic-title">{{ item.title }}</div>
            <div class="topic-recommendation">{{ item.snippet || item.recommendation }}</div>
            <div class="topic-meta">
              <span class="topic-heat" v-if="item.heat_score">
                <van-icon name="fire" />
                {{ item.heat_score }}
              </span>
              <span class="topic-platform" v-if="item.platform">{{ item.platform }}</span>
            </div>
          </div>
          <div class="topic-arrow" v-if="item.url">
            <van-icon name="arrow" />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-container">
      <div class="empty-icon">🎯</div>
      <div class="empty-text">输入关键词开始搜索</div>
      <div class="empty-hint">例如：AI, 世界杯, 科技新闻...</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { showToast } from 'vant';

const searchKeyword = ref('');
const searching = ref(false);
const searchError = ref(null);
const results = ref([]);

const onSearch = async () => {
  if (!searchKeyword.value.trim()) {
    showToast('请输入搜索关键词');
    return;
  }

  searching.value = true;
  searchError.value = null;

  try {
    const query = encodeURIComponent(searchKeyword.value.trim());
    const response = await fetch(`https://api.duckduckgo.com/?q=${query}&format=json&no_html=1&skip_disambig=0`);
    const data = await response.json();

    let allResults = [];
    
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      data.RelatedTopics.forEach(item => {
        if (item.Topics && item.Topics.length > 0) {
          allResults = allResults.concat(item.Topics);
        } else if (item.FirstURL) {
          allResults.push(item);
        }
      });
    }

    if (data.AbstractURL) {
      allResults.unshift({
        Text: data.AbstractText || data.Abstract,
        FirstURL: data.AbstractURL
      });
    }

    if (allResults.length > 0) {
      results.value = allResults.slice(0, 10).map((item, index) => ({
        title: item.Text || item.FirstURL?.replace(/^https?:\/\//, '').replace(/\/.*/, '') || '未命名',
        url: item.FirstURL,
        snippet: item.Text || '',
        category: '搜索结果',
        platform: 'DuckDuckGo',
        heat_score: 100 - index * 5,
        recommendation: item.Text ? item.Text.substring(0, 80) + '...' : '点击访问原文'
      })).filter(item => item.url);
      showToast(`找到 ${results.value.length} 个结果`);
    } else {
      results.value = [];
      showToast('未找到相关结果');
    }
  } catch (err) {
    searchError.value = '搜索失败，请重试';
    console.error(err);
    results.value = [];
  } finally {
    searching.value = false;
  }
};

const onTopicClick = (item) => {
  if (item.url) {
    window.open(item.url, '_blank');
  } else {
    showToast('链接不可用');
  }
};

const getRankClass = (rank) => {
  if (rank === 1) return 'rank-first';
  if (rank === 2) return 'rank-second';
  if (rank === 3) return 'rank-third';
  return '';
};
</script>

<style scoped>
.daily-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 30px;
}

.nav-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.search-section {
  padding: 16px;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: sticky;
  top: 56px;
  z-index: 99;
}

.search-input {
  margin-bottom: 12px;
}

.loading-container,
.error-container,
.empty-container {
  padding: 60px 20px;
  text-align: center;
}

.error-icon,
.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.error-message,
.empty-text {
  color: #646566;
  margin-bottom: 12px;
  font-size: 16px;
}

.empty-hint {
  color: #969799;
  font-size: 14px;
}

.results-section {
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #191919;
}

.section-count {
  font-size: 14px;
  color: #969799;
}

.topics-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.topic-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transition: all 0.3s;
}

.topic-card:active {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.topic-rank {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.topic-rank.rank-first {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
}

.topic-rank.rank-second {
  background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
}

.topic-rank.rank-third {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
}

.topic-content {
  flex: 1;
  min-width: 0;
}

.topic-category {
  font-size: 12px;
  color: #1989fa;
  margin-bottom: 4px;
  font-weight: 500;
}

.topic-title {
  font-size: 15px;
  font-weight: 500;
  color: #191919;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-recommendation {
  font-size: 13px;
  color: #646566;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 6px;
}

.topic-meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.topic-heat,
.topic-platform {
  font-size: 12px;
  color: #969799;
  display: flex;
  align-items: center;
  gap: 4px;
}

.topic-arrow {
  color: #c8c9cc;
  flex-shrink: 0;
}
</style>