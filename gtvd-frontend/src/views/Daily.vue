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
            <div class="topic-recommendation">{{ item.recommendation || '' }}</div>
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
import { showToast, showDialog } from 'vant';

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
    // 使用模拟搜索结果
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 根据关键词生成模拟结果
    const keywords = searchKeyword.value.trim().toLowerCase();
    const mockResults = generateMockResults(keywords);
    results.value = mockResults;
    
    showToast(`找到 ${mockResults.length} 个结果`);
  } catch (err) {
    searchError.value = '搜索失败，请重试';
    console.error(err);
  } finally {
    searching.value = false;
  }
};

const generateMockResults = (keyword) => {
  const baseTopics = [
    { 
      title: `AI技术最新突破：${keyword}相关`, 
      category: 'AI与科技', 
      platform: 'YouTube', 
      heat_score: 95, 
      url: 'https://youtube.com/watch?v=demo1',
      recommendation: '值得关注的AI发展趋势'
    },
    { 
      title: `热门话题讨论：${keyword}`, 
      category: '社会事件', 
      platform: 'Twitter', 
      heat_score: 92, 
      url: 'https://twitter.com/status/demo2',
      recommendation: '网友热议的话题'
    },
    { 
      title: `${keyword}相关视频合集`, 
      category: '娱乐', 
      platform: 'TikTok', 
      heat_score: 88, 
      url: 'https://tiktok.com/@user/video/demo3',
      recommendation: '精选视频推荐'
    },
    { 
      title: `深度解析${keyword}`, 
      category: 'AI与科技', 
      platform: 'YouTube', 
      heat_score: 85, 
      url: 'https://youtube.com/watch?v=demo4',
      recommendation: '专业分析报告'
    },
    { 
      title: `${keyword}热门排行榜`, 
      category: '生活创意', 
      platform: 'Instagram', 
      heat_score: 80, 
      url: 'https://instagram.com/p/demo5',
      recommendation: '最新榜单'
    }
  ];

  // 根据关键词调整标题
  return baseTopics.map(item => ({
    ...item,
    title: item.title.replace('${keyword}', keyword)
  }));
};

const onTopicClick = (item) => {
  if (item.url) {
    showDialog({
      title: item.title,
      message: `打开链接: ${item.url}`,
      confirmButtonText: '打开',
      cancelButtonText: '取消',
    }).then(() => {
      window.open(item.url, '_blank');
    }).catch(() => {});
  } else {
    showToast('暂无链接');
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
