<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, View, ChatDotRound, More, Top } from '@element-plus/icons-vue'
import {
  getPostDetail,
  likePost,
  unlikePost,
  deletePost,
  getCommentList,
  addComment
} from '@/api/square'
import { formatDetailTime } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 响应式数据
const loading = ref(false)
const post = ref(null)
const comments = ref([])
const newComment = ref('')
const commentLoading = ref(false)
const showBackToTop = ref(false)

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

  // 监听el-main容器的滚动事件
  const elMain = document.querySelector('.el-main')
  if (elMain) {
    elMain.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  // 移除滚动监听
  const elMain = document.querySelector('.el-main')
  if (elMain) {
    elMain.removeEventListener('scroll', handleScroll)
  }
})

// 滚动到评论区
const scrollToComments = () => {
  const commentsElement = document.querySelector('.comments-section')
  if (commentsElement) {
    commentsElement.scrollIntoView({
      behavior: 'smooth'
    })
  }
}

// 返回顶部
const scrollToTop = () => {
  const elMain = document.querySelector('.el-main')
  if (elMain) {
    elMain.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }
}

// 监听滚动事件
const handleScroll = (event) => {
  let scrollTop = 0

  // 获取el-main容器的滚动位置
  if (event && event.target) {
    scrollTop = event.target.scrollTop || 0
  } else {
    const elMain = document.querySelector('.el-main')
    scrollTop = elMain ? elMain.scrollTop : 0
  }

  showBackToTop.value = scrollTop > 150
}

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

// 处理下拉菜单命令
const handleCommand = (command) => {
  switch (command) {
    case 'delete':
      handleDeletePost()
      break
    // 可以在这里添加更多操作选项
    default:
      break
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

// 格式化内容 - 将EditorJS JSON转换为HTML
const formatContent = (content) => {
  if (!content) return ''

  // 如果已经是HTML字符串，直接返回
  if (typeof content === 'string' && !content.startsWith('{')) {
    return content
  }

  try {
    // 解析EditorJS JSON
    const editorData =
      typeof content === 'string' ? JSON.parse(content) : content

    if (!editorData.blocks || !Array.isArray(editorData.blocks)) {
      return content
    }

    // 将blocks转换为HTML
    const htmlBlocks = editorData.blocks.map((block) => {
      switch (block.type) {
        case 'paragraph':
          return `<p>${block.data.text || ''}</p>`

        case 'header': {
          const level = block.data.level || 2
          return `<h${level}>${block.data.text || ''}</h${level}>`
        }

        case 'list': {
          const items = (block.data.items || [])
            .map((item) => {
              // 处理不同类型的列表项
              if (typeof item === 'object' && item.content) {
                return `<li>${item.content}</li>`
              } else if (typeof item === 'string') {
                return `<li>${item}</li>`
              }
              return ''
            })
            .filter((item) => item)
            .join('')
          return block.data.style === 'ordered'
            ? `<ol>${items}</ol>`
            : `<ul>${items}</ul>`
        }

        case 'quote': {
          const quote = block.data.text || ''
          const quoteCaption = block.data.caption
            ? `<cite>${block.data.caption}</cite>`
            : ''
          return `<blockquote>${quote}${quoteCaption}</blockquote>`
        }

        case 'code': {
          const code = block.data.code || ''
          const caption = block.data.caption
            ? `<div class="code-caption">${block.data.caption}</div>`
            : ''
          return `<div class="code-block">${caption}<pre><code>${code}</code></pre></div>`
        }

        case 'delimiter':
          return '<hr class="content-delimiter">'

        case 'raw':
          return block.data.html || ''

        case 'image': {
          const src = block.data.file?.url || block.data.url || ''
          const imageCaption = block.data.caption
            ? `<figcaption>${block.data.caption}</figcaption>`
            : ''
          return src
            ? `<figure class="image-figure"><img src="${src}" alt="${
                block.data.caption || ''
              }">${imageCaption}</figure>`
            : ''
        }

        case 'table': {
          if (!block.data.content || !Array.isArray(block.data.content)) {
            return '<div class="table-placeholder">表格内容无法显示</div>'
          }

          const rows = block.data.content
            .map((row, rowIndex) => {
              if (!Array.isArray(row)) return ''
              const cells = row
                .map((cell) => {
                  const tag = rowIndex === 0 ? 'th' : 'td'
                  return `<${tag}>${cell || ''}</${tag}>`
                })
                .join('')
              return `<tr>${cells}</tr>`
            })
            .join('')

          return `<div class="table-container"><table class="content-table">${rows}</table></div>`
        }

        case 'checklist': {
          if (!block.data.items || !Array.isArray(block.data.items)) {
            return ''
          }

          const items = block.data.items
            .map((item) => {
              const checked = item.checked ? 'checked' : ''
              const text = item.text || ''
              return `
                <li class="checklist-item">
                  <input type="checkbox" ${checked} disabled>
                  <span>${text}</span>
                </li>
              `
            })
            .join('')

          return `<ul class="checklist">${items}</ul>`
        }

        case 'warning':
        case 'alert': {
          const title = block.data.title || '提醒'
          const message = block.data.message || block.data.text || ''
          return `
            <div class="warning-block">
              <div class="warning-title">⚠️ ${title}</div>
              <div class="warning-message">${message}</div>
            </div>
          `
        }

        case 'embed': {
          const service = block.data.service || '未知服务'
          const source = block.data.source || block.data.embed || ''
          const caption = block.data.caption || ''

          if (block.data.service === 'youtube' && block.data.embed) {
            return `
              <div class="embed-container">
                <iframe src="${
                  block.data.embed
                }" frameborder="0" allowfullscreen></iframe>
                ${caption ? `<p class="embed-caption">${caption}</p>` : ''}
              </div>
            `
          }

          return `
            <div class="embed-placeholder">
              <div class="embed-service">[${service} 嵌入内容]</div>
              ${source ? `<div class="embed-source">${source}</div>` : ''}
              ${caption ? `<p class="embed-caption">${caption}</p>` : ''}
            </div>
          `
        }

        case 'linkTool': {
          const url = block.data.link || '#'
          const title = block.data.meta?.title || url
          const description = block.data.meta?.description || ''
          const image = block.data.meta?.image?.url || ''

          return `
            <div class="link-preview">
              ${
                image
                  ? `<img src="${image}" class="link-image" alt="${title}">`
                  : ''
              }
              <div class="link-content">
                <a href="${url}" target="_blank" class="link-title">${title}</a>
                ${
                  description
                    ? `<p class="link-description">${description}</p>`
                    : ''
                }
                <span class="link-url">${url}</span>
              </div>
            </div>
          `
        }

        case 'attaches': {
          const file = block.data.file || {}
          const title = file.title || file.name || '附件'
          const size = file.size ? `(${(file.size / 1024).toFixed(1)}KB)` : ''
          const url = file.url || '#'

          return `
            <div class="attachment">
              <a href="${url}" download class="attachment-link">
                📎 ${title} ${size}
              </a>
            </div>
          `
        }

        case 'marker':
        case 'inlineCode':
          return `<p><code class="inline-code">${
            block.data.text || ''
          }</code></p>`

        default: {
          // 对于不识别的block类型，尝试提取text字段
          if (block.data.text) {
            return `<p>${block.data.text}</p>`
          } else if (block.data.html) {
            return block.data.html
          } else if (typeof block.data === 'string') {
            return `<p>${block.data}</p>`
          }
          return ''
        }
      }
    })

    return htmlBlocks.join('')
  } catch (error) {
    console.warn('解析EditorJS内容失败:', error)
    return content
  }
}
</script>

<template>
  <page-container :title="post?.title" class="post-detail-container">
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
              <div class="username">{{ post.username }}</div>
              <div class="post-time">
                {{ formatDetailTime(post.created_at) }}
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="post-actions">
            <el-dropdown
              v-if="canDelete"
              trigger="hover"
              placement="bottom-end"
              @command="handleCommand"
            >
              <el-button text circle>
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="delete" class="delete-item">
                    <el-icon><Delete /></el-icon>
                    删除帖子
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 帖子内容 -->
        <div class="post-body">
          <div
            class="post-content-text"
            v-html="formatContent(post.content)"
          ></div>
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
                    formatDetailTime(comment.create_time)
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
        <el-empty description="帖子不存在或已被删除"> </el-empty>
      </div>
    </div>

    <!-- B站风格侧边工具栏 -->
    <div v-if="post" class="side-toolbar">
      <!-- 点赞 -->
      <div class="toolbar-item" @click="toggleLike">
        <div class="toolbar-icon" :class="{ active: post.is_liked }">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
            />
          </svg>
        </div>
        <span class="toolbar-text">{{ post.like_count || 0 }}</span>
      </div>

      <!-- 评论 -->
      <div class="toolbar-item" @click="scrollToComments">
        <div class="toolbar-icon">
          <el-icon><ChatDotRound /></el-icon>
        </div>
        <span class="toolbar-text">{{ post.comment_count || 0 }}</span>
      </div>

      <!-- 浏览量 -->
      <div class="toolbar-item">
        <div class="toolbar-icon">
          <el-icon><View /></el-icon>
        </div>
        <span class="toolbar-text">{{ post.view_count || 0 }}</span>
      </div>

      <!-- 返回顶部 -->
      <div v-if="showBackToTop" class="toolbar-item" @click="scrollToTop">
        <div class="toolbar-icon">
          <el-icon><Top /></el-icon>
        </div>
        <span class="toolbar-text">顶部</span>
      </div>
    </div>
  </page-container>
</template>

<style lang="scss" scoped>
.post-detail-container {
  max-width: 800px;
  margin: 0 auto;

  :deep(.el-card__header) {
    border-bottom: none;
    padding: 20px 20px 0px 20px;
  }
  // 让 page-container 卡片占满可用空间
  :deep(.el-card__body) {
    padding: 0;
  }

  // 直接选择 page-container 内的 header 元素
  :deep(.el-card__header .header) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    // 标题样式
    span {
      font-size: 24px;
      font-weight: 700;
      margin-left: 10px;
    }
  }
}

.post-detail {
  // 移除默认的 page-container 内边距，让 post-content 占满空间
  margin: 0;

  .post-content {
    background: white;
    border-radius: 8px;
    padding: 24px;
    // 确保内容占满容器宽度
    width: 100%;
    box-sizing: border-box;
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid #f0e8e8;
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

    // 操作按钮区域
    .post-actions {
      .el-dropdown {
        .el-button {
          color: #909399;
          background-color: white;

          &:hover {
            color: #505153;
            background-color: #f5f5f5;
          }
        }
      }
    }
  }

  // 下拉菜单样式
  :deep(.el-dropdown-menu) {
    .delete-item {
      color: #f56c6c;

      &:hover {
        color: #f56c6c;
        background-color: #fef0f0;
      }

      .el-icon {
        margin-right: 8px;
      }
    }
  }

  .post-body {
    margin-bottom: 32px;

    .post-content-text {
      color: #606266;
      line-height: 1.8;
      font-size: 16px;
      white-space: pre-wrap;

      // EditorJS HTML内容样式
      :deep(h1),
      :deep(h2),
      :deep(h3),
      :deep(h4),
      :deep(h5),
      :deep(h6) {
        color: #303133;
        margin: 20px 0 12px 0;
        font-weight: 600;
      }

      :deep(h1) {
        font-size: 24px;
      }
      :deep(h2) {
        font-size: 20px;
      }
      :deep(h3) {
        font-size: 18px;
      }

      :deep(p) {
        margin: 12px 0;
        line-height: 1.8;
      }

      :deep(ul),
      :deep(ol) {
        margin: 12px 0;
        padding-left: 20px;
      }

      :deep(li) {
        margin: 4px 0;
      }

      :deep(blockquote) {
        border-left: 4px solid #409eff;
        padding-left: 16px;
        margin: 16px 0;
        background: #f8f9fa;
        color: #606266;
        border-radius: 0 4px 4px 0;
      }

      :deep(cite) {
        display: block;
        margin-top: 8px;
        font-style: italic;
        color: #909399;
        font-size: 14px;
      }

      :deep(pre) {
        background: #f5f5f5;
        border: 1px solid #e5e5e5;
        border-radius: 4px;
        padding: 16px;
        overflow-x: auto;
        margin: 16px 0;
      }

      :deep(code) {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 14px;
        color: #e83e8c;
      }

      :deep(hr) {
        border: none;
        border-top: 1px solid #e5e5e5;
        margin: 24px 0;
      }

      :deep(figure) {
        margin: 16px 0;
        text-align: center;
      }

      :deep(img) {
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      :deep(figcaption) {
        margin-top: 8px;
        font-size: 14px;
        color: #909399;
        text-align: center;
      }

      // 新增组件样式
      :deep(.table-container) {
        margin: 16px 0;
        overflow-x: auto;
      }

      :deep(.content-table) {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid #e5e5e5;

        th,
        td {
          border: 1px solid #e5e5e5;
          padding: 8px 12px;
          text-align: left;
        }

        th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #303133;
        }

        td {
          color: #606266;
        }

        tr:nth-child(even) {
          background-color: #fafafa;
        }
      }

      :deep(.table-placeholder) {
        padding: 20px;
        text-align: center;
        color: #909399;
        background: #f8f9fa;
        border: 1px dashed #d9d9d9;
        border-radius: 4px;
        margin: 16px 0;
      }

      :deep(.checklist) {
        list-style: none;
        padding: 0;
        margin: 16px 0;

        .checklist-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 8px 0;

          input[type='checkbox'] {
            margin-top: 2px;
            pointer-events: none;
          }

          span {
            flex: 1;
            line-height: 1.6;
          }
        }
      }

      :deep(.warning-block) {
        background: linear-gradient(135deg, #fff4e6 0%, #fef7ed 100%);
        border: 1px solid #fbbf24;
        border-left: 4px solid #f59e0b;
        border-radius: 4px;
        padding: 16px;
        margin: 16px 0;

        .warning-title {
          font-weight: 600;
          color: #92400e;
          margin-bottom: 8px;
          font-size: 16px;
        }

        .warning-message {
          color: #a16207;
          line-height: 1.6;
        }
      }

      :deep(.code-block) {
        margin: 16px 0;

        .code-caption {
          background: #f1f1f1;
          padding: 8px 16px;
          font-size: 14px;
          color: #666;
          border-radius: 4px 4px 0 0;
          border: 1px solid #e5e5e5;
          border-bottom: none;
        }

        pre {
          margin: 0;
          border-radius: 0 0 4px 4px;
        }
      }

      :deep(.content-delimiter) {
        border: none;
        border-top: 2px solid #e5e5e5;
        margin: 32px 0;
        background: linear-gradient(
          to right,
          transparent,
          #e5e5e5 20%,
          #e5e5e5 80%,
          transparent
        );
        height: 1px;
      }

      :deep(.embed-container) {
        margin: 20px 0;
        position: relative;
        padding-bottom: 56.25%; // 16:9 aspect ratio
        height: 0;
        overflow: hidden;

        iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 8px;
        }

        .embed-caption {
          position: absolute;
          bottom: -30px;
          left: 0;
          right: 0;
          text-align: center;
          color: #909399;
          font-size: 14px;
          margin: 8px 0 0 0;
        }
      }

      :deep(.embed-placeholder) {
        border: 1px dashed #d9d9d9;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        margin: 16px 0;
        background: #fafafa;

        .embed-service {
          font-weight: 600;
          color: #409eff;
          font-size: 16px;
          margin-bottom: 8px;
        }

        .embed-source {
          color: #606266;
          font-size: 14px;
          word-break: break-all;
          margin-bottom: 8px;
        }

        .embed-caption {
          color: #909399;
          font-size: 14px;
          margin: 8px 0 0 0;
        }
      }

      :deep(.link-preview) {
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        overflow: hidden;
        margin: 16px 0;
        transition: box-shadow 0.3s ease;

        &:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .link-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          display: block;
        }

        .link-content {
          padding: 16px;

          .link-title {
            font-weight: 600;
            color: #409eff;
            text-decoration: none;
            font-size: 16px;
            line-height: 1.4;
            display: block;
            margin-bottom: 8px;

            &:hover {
              text-decoration: underline;
            }
          }

          .link-description {
            color: #606266;
            font-size: 14px;
            line-height: 1.5;
            margin: 8px 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .link-url {
            color: #909399;
            font-size: 12px;
            word-break: break-all;
          }
        }
      }

      :deep(.attachment) {
        margin: 16px 0;
        padding: 12px;
        border: 1px solid #e5e5e5;
        border-radius: 6px;
        background: #fafafa;

        .attachment-link {
          color: #409eff;
          text-decoration: none;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;

          &:hover {
            color: #66b1ff;
            text-decoration: underline;
          }
        }
      }

      :deep(.inline-code) {
        background: #f5f5f5;
        border: 1px solid #e5e5e5;
        border-radius: 3px;
        padding: 2px 6px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 13px;
        color: #e83e8c;
      }

      :deep(.image-figure) {
        margin: 20px 0;
        text-align: center;

        img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: transform 0.3s ease;
        }
      }
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

// B站风格侧边工具栏
.side-toolbar {
  position: fixed;
  right: 200px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .toolbar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 12px 8px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(10px);

    &:hover {
      background: rgba(255, 255, 255, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      transform: translateY(-2px);
    }

    .toolbar-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      transition: color 0.3s ease;

      svg {
        width: 20px;
        height: 20px;
      }

      .el-icon {
        font-size: 20px;
      }

      &.active {
        color: #409eff;
      }
    }

    .toolbar-text {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
      font-weight: 500;
      min-width: 24px;
      text-align: center;
    }

    &:hover .toolbar-icon {
      color: #409eff;
    }

    &:hover .toolbar-text {
      color: #409eff;
    }
  }

  // 点赞按钮特殊样式
  .toolbar-item:first-child {
    .toolbar-icon.active {
      color: #409eff;
    }

    &:hover .toolbar-icon.active {
      color: #66b1ff;
    }
  }
}

// 响应式适配
@media (max-width: 1200px) {
  .side-toolbar {
    right: 20px;
  }
}

@media (max-width: 768px) {
  .side-toolbar {
    display: none;
  }
}
</style>
