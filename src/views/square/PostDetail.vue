<template>
  <page-container title="帖子详情" class="post-detail-container">
    <template #extra>
      <el-button @click="goBack" plain>
        <el-icon><ArrowLeft /></el-icon>
        返回广场
      </el-button>
    </template>

    <div v-loading="loading" class="post-detail">
      <div v-if="post" class="post-content">
        <!-- 帖子头部信息 -->
        <div class="post-header">
          <div class="user-info">
            <el-avatar
              :src="post.user_pic || '/src/assets/avatar.png'"
              :size="50"
            />
            <div class="user-details">
              <div class="username">{{ post.nickname || post.username }}</div>
              <div class="post-time">{{ formatTime(post.create_time) }}</div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="post-actions">
            <el-button
              v-if="canDelete"
              @click="handleDeletePost"
              type="danger"
              plain
            >
              <el-icon><Delete /></el-icon>
              删除帖子
            </el-button>
          </div>
        </div>

        <!-- 帖子标题和内容 -->
        <div class="post-body">
          <h1 class="post-title">{{ post.title }}</h1>
          <div class="post-content-text">{{ post.content }}</div>
        </div>

        <!-- 互动区域 -->
        <div class="post-interactions">
          <div class="stats">
            <span class="stat-item">
              <el-icon><View /></el-icon>
              浏览 {{ post.view_count || 0 }}
            </span>
            <span class="stat-item">
              <el-icon><ChatDotRound /></el-icon>
              评论 {{ post.comment_count || 0 }}
            </span>
          </div>

          <el-button
            @click="toggleLike"
            :type="post.is_liked ? 'primary' : ''"
            plain
          >
            <el-icon><Star /></el-icon>
            {{ post.is_liked ? '已点赞' : '点赞' }} ({{ post.like_count || 0 }})
          </el-button>
        </div>

        <!-- 评论区域 -->
        <div class="comments-section">
          <div class="comments-header">
            <h3>评论区</h3>
          </div>

          <!-- 发表评论 -->
          <div class="comment-form">
            <el-input
              v-model="newComment"
              type="textarea"
              :rows="3"
              placeholder="写下你的想法..."
              maxlength="500"
              show-word-limit
            />
            <div class="form-actions">
              <el-button
                @click="submitComment"
                type="primary"
                :loading="commentLoading"
                :disabled="!newComment.trim()"
              >
                发表评论
              </el-button>
            </div>
          </div>

          <!-- 评论列表 -->
          <div class="comments-list">
            <div v-if="comments.length === 0" class="empty-comments">
              暂无评论，快来发表第一个评论吧~
            </div>
            <div v-else>
              <!-- 这里后续会用评论组件替换 -->
              <div
                v-for="comment in comments"
                :key="comment.id"
                class="comment-item"
              >
                <div class="comment-user">
                  <el-avatar :size="30" :src="comment.user_pic" />
                  <span class="comment-username">{{
                    comment.nickname || comment.username
                  }}</span>
                  <span class="comment-time">{{
                    formatTime(comment.create_time)
                  }}</span>
                </div>
                <div class="comment-content">{{ comment.content }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 帖子不存在 -->
      <div v-else-if="!loading" class="post-not-found">
        <el-empty description="帖子不存在或已被删除">
          <el-button type="primary" @click="goBack">返回广场</el-button>
        </el-empty>
      </div>
    </div>
  </page-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Delete,
  View,
  ChatDotRound,
  Star
} from '@element-plus/icons-vue'
import {
  getPostDetail,
  likePost,
  unlikePost,
  deletePost,
  getCommentList,
  addComment
} from '@/api/square'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const loading = ref(false)
const post = ref(null)
const comments = ref([])
const newComment = ref('')
const commentLoading = ref(false)

// 计算属性
const canDelete = computed(() => {
  if (!post.value || !userStore.user) return false
  return (
    userStore.user.role === 'admin' || post.value.user_id === userStore.user.id
  )
})

onMounted(async () => {
  await loadPost()
  await loadComments()
})

// 加载帖子详情
const loadPost = async () => {
  loading.value = true
  try {
    const res = await getPostDetail(route.params.id)
    post.value = res.data?.data || res.data
  } catch (error) {
    console.error('加载帖子详情失败:', error)
    ElMessage.error('加载帖子详情失败')
  } finally {
    loading.value = false
  }
}

// 加载评论列表
const loadComments = async () => {
  try {
    const res = await getCommentList(route.params.id)
    comments.value = res.data?.data || res.data || []
  } catch (error) {
    console.error('加载评论失败:', error)
    // 评论加载失败不阻止页面显示
  }
}

// 点赞/取消点赞
const toggleLike = async () => {
  if (!post.value) return

  try {
    if (post.value.is_liked) {
      await unlikePost(post.value.id)
      post.value.is_liked = false
      post.value.like_count = Math.max(0, post.value.like_count - 1)
    } else {
      await likePost(post.value.id)
      post.value.is_liked = true
      post.value.like_count += 1
    }
  } catch (error) {
    console.error('点赞操作失败:', error)
    ElMessage.error('操作失败')
  }
}

// 删除帖子
const handleDeletePost = async () => {
  try {
    await ElMessageBox.confirm('确定要删除这个帖子吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deletePost(post.value.id)
    ElMessage.success('删除成功')
    router.push('/square')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除帖子失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 提交评论
const submitComment = async () => {
  if (!newComment.value.trim()) return

  commentLoading.value = true
  try {
    await addComment({
      postId: route.params.id,
      content: newComment.value.trim()
    })

    ElMessage.success('评论发表成功')
    newComment.value = ''
    await loadComments() // 重新加载评论列表

    // 更新帖子的评论数
    if (post.value) {
      post.value.comment_count += 1
    }
  } catch (error) {
    console.error('发表评论失败:', error)
    ElMessage.error('发表评论失败')
  } finally {
    commentLoading.value = false
  }
}

// 返回广场
const goBack = () => {
  router.push('/square')
}

// 格式化时间
const formatTime = (timeStr) => {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style lang="scss" scoped>
.post-detail-container {
  max-width: 800px;
  margin: 0 auto;
}

.post-detail {
  .post-content {
    background: white;
    border-radius: 8px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 24px;

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .user-details {
        .username {
          font-weight: 500;
          color: #409eff;
          font-size: 16px;
        }

        .post-time {
          color: #909399;
          font-size: 13px;
          margin-top: 4px;
        }
      }
    }
  }

  .post-body {
    margin-bottom: 32px;

    .post-title {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 16px 0;
      line-height: 1.4;
    }

    .post-content-text {
      color: #606266;
      line-height: 1.8;
      font-size: 16px;
      white-space: pre-wrap;
    }
  }

  .post-interactions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 0;
    border-top: 1px solid #f0f0f0;
    border-bottom: 1px solid #f0f0f0;
    margin-bottom: 32px;

    .stats {
      display: flex;
      gap: 24px;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #909399;
        font-size: 14px;

        .el-icon {
          font-size: 16px;
        }
      }
    }
  }

  .comments-section {
    .comments-header {
      h3 {
        margin: 0 0 20px 0;
        color: #303133;
      }
    }

    .comment-form {
      margin-bottom: 32px;

      .form-actions {
        margin-top: 12px;
        display: flex;
        justify-content: flex-end;
      }
    }

    .comments-list {
      .empty-comments {
        text-align: center;
        color: #909399;
        padding: 40px 0;
      }

      .comment-item {
        border: 1px solid #f0f0f0;
        border-radius: 6px;
        padding: 16px;
        margin-bottom: 12px;

        .comment-user {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;

          .comment-username {
            font-weight: 500;
            color: #409eff;
            font-size: 14px;
          }

          .comment-time {
            color: #909399;
            font-size: 12px;
            margin-left: auto;
          }
        }

        .comment-content {
          color: #606266;
          line-height: 1.6;
        }
      }
    }
  }

  .post-not-found {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 400px;
  }
}
</style>
