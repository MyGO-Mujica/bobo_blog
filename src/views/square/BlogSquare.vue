<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores'
import { Star, EditPen } from '@element-plus/icons-vue'

const userStore = useUserStore()

// 组件状态
const loading = ref(false)
const posts = ref([])

// 权限相关
const isAdmin = ref(false)

onMounted(async () => {
  await checkUserRole()
  await loadPosts()
})

// 检查用户角色
const checkUserRole = async () => {
  // TODO: 从后端获取用户角色信息
  // 临时使用用户信息判断
  isAdmin.value = userStore.user?.role === 'admin'
}

// 加载帖子列表
const loadPosts = async () => {
  loading.value = true
  try {
    // TODO: 调用API获取帖子列表
    posts.value = []
  } catch (error) {
    ElMessage.error('加载帖子失败')
  } finally {
    loading.value = false
  }
}

// 发布新帖子
const createPost = () => {
  // TODO: 打开发帖弹窗
  ElMessage.info('发帖功能开发中...')
}
</script>

<template>
  <page-container title="博客广场">
    <template #extra>
      <div class="header-actions">
        <!-- 管理员标识-->
        <div v-if="isAdmin" class="admin-badge-bilibili">
          <el-icon class="crown-icon"><Star /></el-icon>
          <span class="admin-text">大会员</span>
        </div>

        <!-- 发帖按钮 -->
        <el-button type="primary" @click="createPost">
          <el-icon><EditPen /></el-icon>
          发布帖子
        </el-button>
      </div>
    </template>

    <!-- 内容区域 -->
    <div class="square-content" v-loading="loading">
      <!-- 空状态 -->
      <div v-if="posts.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无帖子">
          <el-button type="primary" @click="createPost">
            发布第一个帖子
          </el-button>
        </el-empty>
      </div>

      <!-- 帖子列表 -->
      <div v-else class="posts-container">
        <!-- TODO: 帖子列表组件 -->
        <div class="post-placeholder">
          <p>帖子列表开发中...</p>
        </div>
      </div>
    </div>
  </page-container>
</template>

<style lang="scss" scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;

  .admin-badge-bilibili {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: linear-gradient(135deg, #ff6b9d 0%, #f093fb 50%, #ff85c1 100%);
    border-radius: 12px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(255, 107, 157, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 255, 255, 0.3),
        transparent
      );
      transition: left 0.6s ease;
    }

    &:hover::before {
      left: 100%;
    }

    .crown-icon {
      font-size: 14px;
      color: #e9f267;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      animation: crown-glow 2s ease-in-out infinite alternate;
    }

    .admin-text {
      position: relative;
      z-index: 1;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      letter-spacing: 0.5px;
    }
  }

  @keyframes crown-glow {
    0% {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }
    100% {
      filter: drop-shadow(0 1px 4px rgba(255, 224, 102, 0.6))
        drop-shadow(0 0 8px rgba(255, 224, 102, 0.4));
    }
  }
}

.square-content {
  min-height: 400px;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
}

.posts-container {
  .post-placeholder {
    text-align: center;
    padding: 80px 20px;
    color: #999;
    font-size: 16px;
  }
}
</style>
