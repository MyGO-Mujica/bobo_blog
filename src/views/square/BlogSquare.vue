<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores'
import { Star, EditPen, Delete } from '@element-plus/icons-vue'
import { getPostList, deletePost } from '@/api/square'
import PostEditor from './components/PostEditor.vue'

const router = useRouter()
const userStore = useUserStore()

// 组件状态
const loading = ref(false)
const posts = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 权限相关
const isAdmin = ref(false)

// PostEditor 组件引用
const postEditorRef = ref()

onMounted(async () => {
  await checkUserRole()
  await loadPosts()
})

// 检查用户角色
const checkUserRole = async () => {
  // 从userStore中获取用户角色信息
  isAdmin.value = userStore.user?.role === 'admin'
}

// 加载帖子列表
const loadPosts = async () => {
  loading.value = true
  try {
    const res = await getPostList({
      page: currentPage.value,
      pageSize: pageSize.value
    })

    const data = res.data?.data || res.data

    posts.value = data.posts || data.content || data || []
    total.value = data.total || data.totalElements || posts.value.length
  } catch (error) {
    console.error('加载帖子失败:', error)
    console.error('错误详情:', error.response?.data)
    ElMessage.error('加载帖子失败')
  } finally {
    loading.value = false
  }
}

// 分页处理
const handlePageChange = (page) => {
  currentPage.value = page
  loadPosts()
}

// 查看帖子详情
const viewPost = (post) => {
  router.push(`/square/post/${post.id}`)
}

// 删除帖子
const handleDeletePost = async (post) => {
  try {
    await ElMessageBox.confirm('确定要删除这个帖子吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deletePost(post.id)
    ElMessage.success('删除成功')
    loadPosts() // 重新加载列表
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除帖子失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 发布新帖子
const createPost = () => {
  postEditorRef.value.open()
}

// 发布成功后的回调
const handlePostSuccess = () => {
  // 重新加载帖子列表
  currentPage.value = 1
  loadPosts()
}

// 格式化相对时间
const formatRelativeTime = (timeStr) => {
  if (!timeStr) return ''
  const now = new Date()
  const date = new Date(timeStr)
  const diff = now - date

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    })
  }
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
        <div class="post-grid">
          <div
            v-for="post in posts"
            :key="post.id"
            class="post-card"
            @click="viewPost(post)"
          >
            <!-- 左侧封面图片 -->
            <div class="post-cover">
              <img
                :src="post.cover_img || '/src/assets/default.png'"
                :alt="post.title"
              />
            </div>

            <!-- 右侧帖子信息 -->
            <div class="post-content">
              <!-- 文章标题 -->
              <h3 class="post-title">{{ post.title }}</h3>

              <!-- 内容预览 -->
              <div class="post-summary">
                {{ post.content?.substring(0, 120) }}
                <span v-if="post.content?.length > 120">...</span>
              </div>

              <!-- 底部区域 -->
              <div class="post-bottom">
                <!-- 统计信息 -->
                <div class="post-stats">
                  <span class="view-count">{{ post.view_count || 0 }}点赞</span>
                  <span class="comment-count">
                    {{ post.comment_count || 0 }}评论
                  </span>
                </div>

                <!-- 作者信息 -->
                <div class="post-author">
                  <el-avatar
                    :src="post.user_pic || '/src/assets/avatar.png'"
                    :size="24"
                  />
                  <span class="username">{{ post.username }}</span>
                  <span class="post-time">{{
                    formatRelativeTime(post.create_time)
                  }}</span>

                  <!-- 删除按钮（仅作者和管理员可见） -->
                  <el-button
                    v-if="isAdmin || post.user_id === userStore.user?.id"
                    @click.stop="handleDeletePost(post)"
                    type="danger"
                    text
                    size="small"
                    class="delete-btn-bottom"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next, jumper"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- 发帖组件 -->
    <PostEditor ref="postEditorRef" @success="handlePostSuccess" />
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
  .post-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 24px;
  }

  .post-card {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    display: flex;
    height: 140px;

    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);

      .post-content .post-bottom .post-author .delete-btn-bottom {
        opacity: 1;
      }
    }

    .post-cover {
      position: relative;
      width: 180px;
      height: 140px;
      flex-shrink: 0;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      &:hover {
        img {
          transform: scale(1.05);
        }
      }
    }

    .post-content {
      flex: 1;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;

      .post-title {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
        margin: 0 0 8px 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        max-height: 2.8em;
      }

      .post-summary {
        color: #606266;
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 12px;
        flex: 1;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .post-bottom {
        margin-top: auto;

        .post-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 12px;
          color: #909399;

          .view-count,
          .comment-count {
            position: relative;

            &::after {
              content: '·';
              margin-left: 8px;
            }

            &:last-child::after {
              display: none;
            }
          }
        }

        .post-author {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;

          .username {
            color: #606266;
            font-weight: 500;
          }

          .post-time {
            color: #c0c4cc;
            margin-left: auto;
          }
          .delete-btn-bottom {
            margin-left: 8px;
            opacity: 0;
            transition: opacity 0.3s ease;
            color: #b75311 !important;
            padding: 4px;

            &:hover {
              color: #bb5555 !important;
              background-color: rgba(245, 108, 108, 0.1) !important;
            }
          }
        }
      }
    }
  }

  .pagination-container {
    display: flex;
    justify-content: center;
    margin-top: 32px;
    padding: 20px 0;
  }

  /* 响应式布局 */
  @media (max-width: 768px) {
    .post-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .post-card {
      height: auto;
      min-height: 120px;

      .post-cover {
        width: 120px;
        height: 120px;
      }

      .post-content {
        padding: 10px 12px;

        .post-title {
          font-size: 14px;
        }

        .post-summary {
          font-size: 12px;
          -webkit-line-clamp: 1;
          line-clamp: 1;
        }
      }
    }
  }

  @media (max-width: 1200px) and (min-width: 769px) {
    .post-grid {
      gap: 16px;
    }

    .post-card {
      height: 130px;

      .post-cover {
        width: 160px;
        height: 130px;
      }

      .post-content .post-title {
        font-size: 14px;
      }
    }
  }
}
</style>
