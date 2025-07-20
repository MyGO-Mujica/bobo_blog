<script setup>
import { ref, computed, watch } from 'vue'
import {
  Edit,
  Delete,
  Document,
  DocumentDelete,
  Plus
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  artGetChannelsService,
  artDelChannelService,
  artGetListService
} from '../../api/article'
import ChannelEdit from './components/ChannelEdit.vue'
import { formatRelativeTime } from '@/utils/format.js'

const allChannels = ref([]) // 存储所有分类数据
const loading = ref(false)
const loadingCounts = ref(new Set()) // 正在加载文章数量的分类ID
const dialog = ref()
const searchKeyword = ref('') // 搜索关键词
const debouncedSearchKeyword = ref('') // 防抖后的搜索关键词

// 排序相关状态
const sortField = ref('')
const sortOrder = ref('') // 'ascending' | 'descending'

// 防抖处理
let debounceTimer = null
watch(
  searchKeyword,
  (newValue) => {
    // 清除之前的定时器
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // 设置新的定时器，300ms后更新防抖关键词
    debounceTimer = setTimeout(() => {
      debouncedSearchKeyword.value = newValue
    }, 300)
  },
  { immediate: true }
)

// 排序值处理函数
const getSortValue = (value, field) => {
  if (field === 'articleCount') {
    // 对于文章数量，未加载的(null)排在最后，加载失败的(undefined)当作0处理
    return value === null ? -1 : Number(value) || 0
  } else if (field === 'create_time' || field === 'update_time') {
    return new Date(value).getTime()
  }
  return value
}

// 计算属性：筛选和排序后的分类列表
const channelList = computed(() => {
  let filtered = allChannels.value

  // 先筛选 - 使用防抖后的关键词
  if (debouncedSearchKeyword.value.trim()) {
    filtered = filtered.filter((channel) =>
      channel.cate_name
        .toLowerCase()
        .includes(debouncedSearchKeyword.value.toLowerCase())
    )
  }

  // 再排序
  if (sortField.value && sortOrder.value) {
    filtered = [...filtered].sort((a, b) => {
      const field = sortField.value
      const aVal = getSortValue(a[field], field)
      const bVal = getSortValue(b[field], field)

      if (aVal < bVal) {
        return sortOrder.value === 'ascending' ? -1 : 1
      }
      if (aVal > bVal) {
        return sortOrder.value === 'ascending' ? 1 : -1
      }
      return 0
    })
  }

  return filtered
})

// 排序变化处理
const handleSortChange = ({ prop, order }) => {
  sortField.value = prop || ''
  sortOrder.value = order || ''
}

// 清除排序
const clearSort = () => {
  sortField.value = 'create_time'
  sortOrder.value = 'descending'
}

// 获取文章数量标签类型
const getTagType = (count) => {
  if (count === 0) return 'info'
  if (count <= 3) return 'warning'
  if (count <= 15) return 'success'
  return 'danger'
}

const getChannelList = async () => {
  loading.value = true
  try {
    const res = await artGetChannelsService()
    // 初始化分类数据，文章数量设为 null 表示未加载
    allChannels.value = res.data.data.map((channel) => ({
      ...channel,
      articleCount: null // null 表示未加载，undefined 表示加载失败
    }))

    // 异步加载前几个分类的文章数量（可见区域优先）
    loadInitialCounts()
  } catch (error) {
    ElMessage.error('获取分类列表失败')
  } finally {
    loading.value = false
  }
}

// 懒加载文章数量
const loadArticleCount = async (channel) => {
  if (channel.articleCount !== null || loadingCounts.value.has(channel.id)) {
    return // 已加载或正在加载
  }

  loadingCounts.value.add(channel.id)
  try {
    const countRes = await artGetListService({
      pagenum: 1,
      pagesize: 1,
      cate_id: channel.id
    })

    // 更新对应分类的文章数量
    const index = allChannels.value.findIndex((c) => c.id === channel.id)
    if (index !== -1) {
      allChannels.value[index].articleCount = countRes.data.total
    }
  } catch (error) {
    // 加载失败，设为 undefined
    const index = allChannels.value.findIndex((c) => c.id === channel.id)
    if (index !== -1) {
      allChannels.value[index].articleCount = undefined
    }
  } finally {
    loadingCounts.value.delete(channel.id)
  }
}

// 加载初始可见的分类数量（前5个）
const loadInitialCounts = async () => {
  const visibleChannels = allChannels.value.slice(0, 5)
  await Promise.all(visibleChannels.map((channel) => loadArticleCount(channel)))
}

getChannelList()

const onDelChannel = async (row) => {
  // 如果已经加载了文章数量，直接使用；否则先加载
  let articleCount = row.articleCount
  if (articleCount === null) {
    try {
      const res = await artGetListService({
        pagenum: 1,
        pagesize: 1,
        cate_id: row.id
      })
      articleCount = res.data.total
    } catch (error) {
      ElMessage.error('检查分类状态失败，请稍后重试')
      return
    }
  }

  if (articleCount > 0) {
    ElMessageBox.alert(
      `该分类下还有 ${articleCount} 篇文章，无法删除。请先删除或移动这些文章到其他分类。`,
      '无法删除分类',
      {
        type: 'warning',
        confirmButtonText: '知道了'
      }
    )
    return
  }

  // 如果没有文章，则可以安全删除
  await ElMessageBox.confirm('确认要删除该分类吗？', '温馨提示', {
    type: 'warning',
    confirmButtonText: '确认',
    cancelButtonText: '取消'
  })

  try {
    await artDelChannelService(row.id)
    ElMessage.success('删除成功')
    getChannelList()
  } catch (error) {
    ElMessage.error('删除失败，请稍后重试')
  }
}
const onEditChannel = (row) => {
  dialog.value.open(row)
}
const onAddChannel = () => {
  dialog.value.open({})
}
const onSuccess = () => {
  getChannelList()
}
</script>

<template>
  <page-container title="文章分类">
    <template #extra>
      <div class="header-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索分类名称"
          clearable
          prefix-icon="Search"
          class="search-input"
        />
        <div class="right-actions">
          <transition name="slide-fade">
            <el-button
              v-if="
                sortField &&
                !(sortField === 'create_time' && sortOrder === 'descending')
              "
              size="small"
              @click="clearSort"
              type="info"
              plain
              class="clear-sort-btn"
            >
              清除排序
            </el-button>
          </transition>
          <el-button
            @click="onAddChannel"
            type="primary"
            class="add-category-btn"
          >
            <el-icon><Plus /></el-icon>
            添加分类
          </el-button>
        </div>
      </div>
    </template>

    <el-table
      v-loading="loading"
      :data="channelList"
      style="width: 95%"
      @sort-change="handleSortChange"
      :default-sort="{ prop: 'create_time', order: 'descending' }"
      class="category-table"
      stripe
    >
      <el-table-column
        prop="cate_name"
        label="分类名称"
        show-overflow-tooltip
      ></el-table-column>
      <el-table-column
        prop="articleCount"
        label="文章数量"
        width="200"
        align="center"
        sortable="custom"
      >
        <template #default="{ row }">
          <div class="article-count-wrapper">
            <el-tag
              v-if="row.articleCount !== null"
              :type="getTagType(row.articleCount || 0)"
              size="small"
              class="article-count-tag"
            >
              <el-icon class="count-icon">
                <Document v-if="(row.articleCount || 0) > 0" />
                <DocumentDelete v-else />
              </el-icon>
              {{ row.articleCount || 0 }} 篇
            </el-tag>
            <el-button
              v-else
              size="small"
              type="primary"
              plain
              @click="loadArticleCount(row)"
              :loading="loadingCounts.has(row.id)"
              class="load-count-btn"
            >
              <template v-if="!loadingCounts.has(row.id)">
                <el-icon><Document /></el-icon>
                加载
              </template>
              <template v-else> 加载中... </template>
            </el-button>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        prop="create_time"
        label="创建时间"
        width="180"
        sortable="custom"
      >
        <template #default="{ row }">
          {{ formatRelativeTime(row.create_time) }}
        </template>
      </el-table-column>
      <el-table-column
        prop="update_time"
        label="修改时间"
        width="180"
        sortable="custom"
      >
        <template #default="{ row }">
          {{ formatRelativeTime(row.update_time) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <!-- row 就是 channelList 的一项， $index 下标 -->
        <template #default="{ row }">
          <el-button
            :icon="Edit"
            circle
            plain
            type="primary"
            @click="onEditChannel(row)"
          ></el-button>
          <el-button
            :icon="Delete"
            circle
            plain
            type="danger"
            @click="onDelChannel(row)"
          ></el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty
          :description="
            debouncedSearchKeyword.trim() ? '没有找到匹配的分类' : '没有数据'
          "
          :image-size="100"
        >
          <template v-if="debouncedSearchKeyword.trim()" #description>
            <div>
              <p>没有找到包含 "{{ debouncedSearchKeyword }}" 的分类</p>
              <el-button
                type="primary"
                @click="searchKeyword = ''"
                size="small"
              >
                清除搜索
              </el-button>
            </div>
          </template>
        </el-empty>
      </template>
    </el-table>

    <channel-edit ref="dialog" @success="onSuccess"></channel-edit>
  </page-container>
</template>

<style lang="scss" scoped>
/* 头部操作区域 */
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  gap: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
}

/* 搜索输入框 */
.search-input {
  width: 200px;
  flex-shrink: 0;

  :deep(.el-input__wrapper) {
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    transition: border-color 0.2s ease;

    &:hover {
      border-color: #c0c4cc;
    }

    &.is-focus {
      border-color: #409eff;
    }
  }

  @media (max-width: 768px) {
    width: 100%;
  }
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    gap: 8px;
    flex-wrap: wrap;
  }
}

/* 清除排序按钮 */
.clear-sort-btn {
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: #409eff;
    border-color: #409eff;
    color: white;
  }
}

/* 添加分类按钮 */
.add-category-btn {
  border-radius: 4px;
  font-weight: 500;

  .el-icon {
    margin-right: 4px;
  }
}

/* 表格样式 */
.category-table {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin: 0 auto; /* 让表格水平居中 */

  :deep(.el-table__header) {
    th {
      background-color: #fafafa;
      color: #606266;
      font-weight: 500;
      border-bottom: 1px solid #ebeef5;
    }
  }

  :deep(.el-table__body) {
    tr {
      transition: background-color 0.2s ease;

      &:hover {
        background-color: #f5f7fa;
      }

      &.el-table__row--striped {
        background-color: #fafbfc;

        &:hover {
          background-color: #f5f7fa;
        }
      }
    }

    td {
      border-bottom: 1px solid #f0f2f5;
      color: #606266;
    }
  }
}

/* 文章数量标签 */
.article-count-wrapper {
  display: flex;
  justify-content: center;
}

.article-count-tag {
  border-radius: 4px;
  font-size: 12px;
  padding: 4px 8px;

  .count-icon {
    font-size: 14px;
    margin-right: 4px;
  }

  /* 自定义标签颜色 - 覆盖Element Plus默认样式 */
  &.el-tag--info {
    background-color: #f4f4f5;
    border-color: #d3d4d6;
    color: #6c757d;

    .count-icon {
      color: #6c757d; /* 无文章时灰色 */
    }
  }

  &.el-tag--warning {
    background-color: #e8f5e8;
    border-color: #95d895;
    color: #52c252;

    .count-icon {
      color: #52c252; /* 1-4篇文章时浅绿色 */
    }
  }

  &.el-tag--success {
    background-color: #d4edda;
    border-color: #7bc17b;
    color: #28a745;

    .count-icon {
      color: #28a745; /* 5-15篇文章时绿色 */
    }
  }

  &.el-tag--danger {
    background-color: #c8e6c9;
    border-color: #4caf50;
    color: #1b5e20;

    .count-icon {
      color: #1b5e20; /* 15篇以上文章时深绿色 */
    }
  }
}

/* 加载数量按钮 */
.load-count-btn {
  border-radius: 4px;
  font-size: 12px;
  padding: 4px 12px;

  .el-icon {
    font-size: 12px;
    margin-right: 4px;
  }

  &:hover {
    transform: translateY(-1px);
  }
}

/* 过渡动画*/
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* 空状态 */
:deep(.el-empty) {
  .el-empty__description {
    color: #909399;
  }

  .el-button {
    border-radius: 4px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .category-table {
    font-size: 14px;
  }
}
</style>
