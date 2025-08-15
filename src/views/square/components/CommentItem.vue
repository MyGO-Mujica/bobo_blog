<template>
  <div class="comment-item">
    <!-- 主评论 -->
    <div class="main-comment">
      <div class="comment-avatar">
        <el-avatar
          :size="36"
          :src="comment.user_pic || '/src/assets/avatar.png'"
        />
      </div>

      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-username">{{
            comment.nickname || comment.username
          }}</span>
        </div>

        <div class="comment-content">{{ comment.content }}</div>

        <div class="comment-footer">
          <div class="comment-actions">
            <span class="comment-time">{{
              formatDetailTime(comment.create_time)
            }}</span>
            <span class="action-btn" @click="toggleReply"> 回复 </span>
          </div>

          <!-- 操作下拉菜单 -->
          <div v-if="canDelete" class="comment-more-actions">
            <el-dropdown
              trigger="hover"
              placement="bottom-end"
              @command="handleCommand"
            >
              <el-button text circle size="small" class="more-btn">
                <el-icon><More /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="delete" class="delete-item">
                    删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <!-- 回复表单 -->
        <div v-if="showReplyForm" class="reply-form">
          <div class="reply-input-wrapper">
            <el-avatar :size="24" :src="currentUserAvatar" />
            <div class="reply-input-container">
              <el-input
                v-model="replyContent"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 4 }"
                :placeholder="`回复 @${comment.nickname || comment.username}`"
                class="reply-input"
              />
              <div class="reply-actions">
                <el-button size="small" @click="cancelReply">取消</el-button>
                <el-button
                  size="small"
                  type="primary"
                  :loading="replyLoading"
                  :disabled="!replyContent.trim()"
                  @click="submitReply"
                >
                  回复
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 子回复区域 (扁平化显示所有回复) -->
    <div v-if="flatReplies && flatReplies.length > 0" class="replies-section">
      <div v-for="reply in flatReplies" :key="reply.id" class="reply-item">
        <div class="reply-avatar">
          <el-avatar
            :size="22"
            :src="reply.user_pic || '/src/assets/avatar.png'"
          />
        </div>

        <div class="reply-body">
          <div class="reply-header">
            <span class="reply-username">{{
              reply.nickname || reply.username
            }}</span>
          </div>

          <div class="reply-content">
            <!-- 如果是回复其他人的评论，显示被回复人 -->
            <span v-if="reply.parent_username" class="reply-target">
              @{{ reply.parent_username }}
            </span>
            {{ reply.content }}
          </div>

          <div class="reply-footer">
            <div class="reply-actions">
              <span class="reply-time">{{
                formatDetailTime(reply.create_time)
              }}</span>
              <span class="action-btn" @click="replyToReply(reply)">
                回复
              </span>
            </div>

            <!-- 回复操作下拉菜单 -->
            <div v-if="canDeleteReply(reply)" class="reply-more-actions">
              <el-dropdown
                trigger="hover"
                placement="bottom-end"
                @command="(command) => handleReplyCommand(command, reply)"
              >
                <el-button text circle size="small" class="more-btn">
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="delete" class="delete-item">
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { More } from '@element-plus/icons-vue'
import { addComment, deleteComment } from '@/api/square'
import { formatDetailTime } from '@/utils/format'

const props = defineProps({
  comment: {
    type: Object,
    required: true
  },
  postId: {
    type: [String, Number],
    required: true
  },
  currentUser: {
    type: Object,
    default: null
  },
  currentUserAvatar: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['reply-success', 'delete-success'])

// 响应式数据
const showReplyForm = ref(false)
const replyContent = ref('')
const replyLoading = ref(false)
const replyTarget = ref(null) // 当前回复的目标

// 计算属性
const canDelete = computed(() => {
  if (!props.currentUser) return false
  return (
    props.currentUser.role === 'admin' ||
    props.comment.user_id === props.currentUser.id
  )
})

// 扁平化所有回复，将嵌套结构转换为一层
const flatReplies = computed(() => {
  if (!props.comment.replies) return []

  const flattenReplies = (replies, parentInfo = null) => {
    const result = []

    for (const reply of replies) {
      // 添加父级信息用于显示 @用户名
      const replyWithParent = {
        ...reply,
        parent_username: parentInfo?.username || parentInfo?.nickname
      }
      result.push(replyWithParent)

      // 如果有子回复，递归处理
      if (reply.replies && reply.replies.length > 0) {
        result.push(...flattenReplies(reply.replies, reply))
      }
    }

    return result
  }

  return flattenReplies(props.comment.replies)
})

// 方法
const handleCommand = (command) => {
  switch (command) {
    case 'delete':
      handleDelete()
      break
    default:
      break
  }
}

const handleReplyCommand = (command, reply) => {
  switch (command) {
    case 'delete':
      deleteReply(reply)
      break
    default:
      break
  }
}

const toggleReply = () => {
  showReplyForm.value = !showReplyForm.value
  replyTarget.value = null // 重置回复目标为主评论
  if (!showReplyForm.value) {
    replyContent.value = ''
  }
}

const replyToReply = (reply) => {
  replyTarget.value = reply
  showReplyForm.value = true
  replyContent.value = ''
}

const cancelReply = () => {
  showReplyForm.value = false
  replyContent.value = ''
  replyTarget.value = null
}

const submitReply = async () => {
  if (!replyContent.value.trim()) return

  replyLoading.value = true
  try {
    await addComment({
      postId: props.postId,
      content: replyContent.value.trim(),
      parentId: replyTarget.value ? replyTarget.value.id : props.comment.id
    })

    ElMessage.success('回复发表成功')
    replyContent.value = ''
    showReplyForm.value = false
    replyTarget.value = null
    emit('reply-success')
  } catch (error) {
    console.error('发表回复失败:', error)
    ElMessage.error('发表回复失败')
  } finally {
    replyLoading.value = false
  }
}

const handleDelete = async () => {
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteComment(props.comment.id)
    ElMessage.success('删除成功')
    emit('delete-success')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除评论失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const canDeleteReply = (reply) => {
  if (!props.currentUser) return false
  return (
    props.currentUser.role === 'admin' || reply.user_id === props.currentUser.id
  )
}

const deleteReply = async (reply) => {
  try {
    await ElMessageBox.confirm('确定要删除这条回复吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteComment(reply.id)
    ElMessage.success('删除成功')
    emit('delete-success')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除回复失败:', error)
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style lang="scss" scoped>
.comment-item {
  padding: 16px 0;

  .main-comment {
    display: flex;
    gap: 12px;

    .comment-avatar {
      flex-shrink: 0;
    }

    .comment-body {
      flex: 1;
      min-width: 0;

      .comment-header {
        margin-bottom: 8px;

        .comment-username {
          font-weight: 500;
          color: #18191c;
          font-size: 14px;
          cursor: pointer;
        }
      }

      .comment-content {
        color: #18191c;
        line-height: 1.6;
        font-size: 13px;
        word-wrap: break-word;
        margin-bottom: 5px;
        white-space: pre-wrap;
      }

      .comment-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .comment-actions {
          display: flex;
          align-items: center;
          gap: 16px;

          .comment-time {
            color: #9499a0;
            font-size: 12px;
          }

          .action-btn {
            color: #9499a0;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              color: #00aeec;
            }
          }
        }

        .comment-more-actions {
          opacity: 0;
          transition: opacity 0.2s ease;

          .el-button {
            color: #9499a0;
            padding: 4px;
            background-color: transparent;

            &:hover {
              color: #00aeec;
              background-color: transparent;
            }

            .el-icon {
              font-size: 14px;
            }
          }
        }
      }
    }

    // 主评论hover时显示More按钮
    &:hover {
      .comment-footer .comment-more-actions {
        opacity: 1;
      }
    }

    .reply-form {
      margin-top: 12px;
      padding: 12px;
      background: #f6f7f8;
      border-radius: 8px;
      border: 1px solid #e3e5e7;

      .reply-input-wrapper {
        display: flex;
        gap: 8px;

        .reply-input-container {
          flex: 1;

          .reply-input {
            margin-bottom: 8px;

            :deep(.el-textarea__inner) {
              resize: none;
              border: 1px solid #e3e5e7;
              border-radius: 6px;
              font-size: 13px;
              line-height: 1.5;
              padding: 8px 12px;
              background: #ffffff;

              &:focus {
                border-color: #00aeec;
                box-shadow: 0 0 0 2px rgba(0, 174, 236, 0.1);
              }

              &::placeholder {
                color: #9499a0;
              }
            }
          }

          .reply-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;

            .el-button {
              font-size: 12px;
              padding: 6px 16px;
              height: 28px;
              border-radius: 4px;

              &.el-button--primary {
                background-color: #00aeec;
                border-color: #00aeec;

                &:hover {
                  background-color: #1db8f0;
                  border-color: #1db8f0;
                }
              }
            }
          }
        }
      }
    }
  }
}

.replies-section {
  padding-left: 48px;
  padding: 8px 0 0 48px;

  .reply-item {
    display: flex;
    gap: 8px;
    padding: 5px 0;
    border &:not(:last-child) {
      border-bottom: 1px solid #e3e5e7;
      padding-bottom: 12px;
      margin-bottom: 10px;
    }

    .reply-avatar {
      margin-top: 10px;
      flex-shrink: 0;
    }

    .reply-body {
      flex: 1;
      min-width: 0;

      .reply-header {
        margin-bottom: 4px;

        .reply-username {
          font-weight: 500;
          color: #18191c;
          font-size: 10px;
          cursor: pointer;
        }
      }

      .reply-content {
        color: #18191c;
        line-height: 1.5;
        font-size: 11px;
        word-wrap: break-word;
        margin-bottom: 6px;

        .reply-target {
          color: #00aeec;
          font-weight: 500;
          margin-right: 4px;
        }
      }

      .reply-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .reply-actions {
          display: flex;
          align-items: center;
          gap: 12px;

          .reply-time {
            color: #9499a0;
            font-size: 10px;
          }

          .action-btn {
            color: #9499a0;
            font-size: 10px;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              color: #00aeec;
            }
          }
        }

        .reply-more-actions {
          opacity: 0;
          transition: opacity 0.2s ease;

          :deep(.el-button) {
            color: #9499a0;
            padding: 2px;
            background-color: transparent !important;
            border: none !important;

            &:hover,
            &:focus,
            &:active,
            &.is-focus {
              color: #00aeec;
              background-color: transparent !important;
              border: none !important;
            }

            .el-icon {
              font-size: 10px;
            }
          }
        }
      }
    }

    // 回复项hover时显示More按钮
    &:hover {
      .reply-footer .reply-more-actions {
        opacity: 1;
      }
    }
  }
}

// More按钮样式 - 去掉所有状态的边框
:deep(.more-btn) {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;

  &:hover,
  &:focus,
  &:active,
  &.is-focus {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background-color: transparent !important;
  }

  // 确保点击后失去焦点时也没有边框
  &:focus-visible {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
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
  }
}

// 响应式设计
@media (max-width: 768px) {
  .comment-item {
    .replies-section {
      margin-left: 0;
      padding-left: 36px;
    }
  }
}
</style>
