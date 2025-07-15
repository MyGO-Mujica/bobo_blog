<script setup>
import { ref, computed } from 'vue'
import { Delete, Edit, View, Picture } from '@element-plus/icons-vue'
import ChannelSelect from './components/ChannelSelect.vue'
import ArticleEdit from './components/ArticleEdit.vue'
import { artGetListService, artDelService } from '@/api/article.js'
import { formatRelativeTime } from '@/utils/format.js'
import { baseURL } from '@/utils/request'

const articleList = ref([]) // 文章列表
const total = ref(0) // 总条数
const loading = ref(false) // loading状态

// 定义请求参数对象
const params = ref({
  pagenum: 1, // 当前页
  pagesize: 5, // 当前生效的每页条数
  cate_id: null,
  state: ''
})

// 预览对话框相关
const previewDialogVisible = ref(false)
const previewArticle = ref({})

// 计算属性：统计信息
const statsInfo = computed(() => {
  const published = articleList.value.filter(
    (item) => item.state === '已发布'
  ).length
  const draft = articleList.value.filter((item) => item.state === '草稿').length
  return { published, draft, total: articleList.value.length }
})

// 基于params参数，获取文章列表
const getArticleList = async () => {
  loading.value = true

  // 创建一个新的参数对象，确保 cate_id 是数字类型
  const queryParams = { ...params.value }
  if (queryParams.cate_id !== '') {
    queryParams.cate_id = Number(queryParams.cate_id)
  }

  const res = await artGetListService(queryParams)
  articleList.value = res.data.data
  total.value = res.data.total

  loading.value = false
}
getArticleList()

// 处理分页逻辑
const onSizeChange = (size) => {
  // console.log('当前每页条数', size)
  // 只要是每页条数变化了，那么原本正在访问的当前页意义不大了，数据大概率已经不在原来那一页了
  // 重新从第一页渲染即可
  params.value.pagenum = 1
  params.value.pagesize = size
  // 基于最新的当前页 和 每页条数，渲染数据
  getArticleList()
}
const onCurrentChange = (page) => {
  // 更新当前页
  params.value.pagenum = page
  // 基于最新的当前页，渲染数据
  getArticleList()
}

// 搜索逻辑 => 按照最新的条件，重新检索，从第一页开始展示
const onSearch = () => {
  params.value.pagenum = 1 // 重置页面
  getArticleList()
}

// 重置逻辑 => 将筛选条件清空，重新检索，从第一页开始展示
const onReset = () => {
  params.value.pagenum = 1 // 重置页面
  params.value.cate_id = null
  params.value.state = ''
  getArticleList()
}

const articleEditRef = ref()
// 添加逻辑
const onAddArticle = () => {
  articleEditRef.value.open({})
}
// 编辑逻辑
const onEditArticle = (row) => {
  articleEditRef.value.open(row)
}

// 删除逻辑
const onDeleteArticle = async (row) => {
  // 提示用户是否要删除
  await ElMessageBox.confirm('此操作将永久删除该文件, 是否继续?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  await artDelService(row.id)
  ElMessage.success('删除成功')
  // 重新渲染列表
  getArticleList()
}

// 添加或者编辑 成功的回调
const onSuccess = (type) => {
  if (type === 'add') {
    // 如果是添加，最好渲染最后一页
    const lastPage = Math.ceil((total.value + 1) / params.value.pagesize)
    // 更新成最大页码数，再渲染
    params.value.pagenum = lastPage
  }

  getArticleList()
}

// 预览文章内容
const onPreviewArticle = (row) => {
  previewArticle.value = row
  previewDialogVisible.value = true
}

// 获取文章内容预览（截取前100字符）
const getContentPreview = (content) => {
  if (!content) return '暂无内容'
  const textContent = content.replace(/<[^>]*>/g, '') // 去除HTML标签
  return textContent.length > 50
    ? textContent.substring(0, 50) + '...'
    : textContent
}

// 获取状态标签类型
const getStateTagType = (state) => {
  return state === '已发布' ? 'success' : 'warning'
}
</script>

<template>
  <page-container title="文章管理">
    <template #extra>
      <div class="header-actions">
        <!-- 统计信息 -->
        <div class="stats-info">
          <el-tag type="info" size="small">总计: {{ total }}</el-tag>
          <el-tag type="success" size="small"
            >已发布: {{ statsInfo.published }}</el-tag
          >
          <el-tag type="warning" size="small"
            >草稿: {{ statsInfo.draft }}</el-tag
          >
        </div>
        <el-button type="primary" @click="onAddArticle">添加文章</el-button>
      </div>
    </template>

    <!-- 表单区域 -->
    <el-form inline>
      <el-form-item label="文章分类:">
        <channel-select v-model="params.cate_id" width="140px"></channel-select>
      </el-form-item>
      <el-form-item label="发布状态:">
        <!-- 这里后台标记发布状态，就是通过中文标记的，已发布 / 草稿 -->
        <el-select v-model="params.state" style="width: 90px">
          <el-option label="已发布" value="已发布"></el-option>
          <el-option label="草稿" value="草稿"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="onSearch" type="primary">搜索</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 表格区域 -->
    <el-table
      :data="articleList"
      v-loading="loading"
      stripe
      border
      style="width: 100%"
      :header-cell-style="{ background: '#fafafa', color: '#333' }"
    >
      <!-- 封面图片列 -->
      <el-table-column label="封面" width="100" align="center">
        <template #default="{ row }">
          <div class="cover-cell">
            <el-image
              v-if="row.cover_img"
              :src="baseURL + row.cover_img"
              fit="cover"
              class="cover-image"
              :preview-src-list="[baseURL + row.cover_img]"
              :hide-on-click-modal="false"
              :preview-teleported="true"
            />
            <el-icon v-else class="no-cover-icon">
              <Picture />
            </el-icon>
          </div>
        </template>
      </el-table-column>

      <!-- 文章标题和内容预览 -->
      <el-table-column label="文章信息" min-width="300">
        <template #default="{ row }">
          <div class="article-info">
            <div class="article-title">
              <el-link
                type="primary"
                :underline="false"
                @click="onPreviewArticle(row)"
              >
                {{ row.title }}
              </el-link>
            </div>
            <div class="article-preview">
              {{ getContentPreview(row.content) }}
            </div>
            <div class="article-meta">
              <el-tag size="small" type="info">{{ row.cate_name }}</el-tag>
              <span class="pub-date">{{
                formatRelativeTime(row.pub_date)
              }}</span>
            </div>
          </div>
        </template>
      </el-table-column>

      <!-- 状态列 -->
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStateTagType(row.state)" size="small">
            {{ row.state }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <div class="action-buttons">
            <el-tooltip content="预览" placement="top">
              <el-button
                circle
                plain
                size="small"
                type="info"
                :icon="View"
                @click="onPreviewArticle(row)"
              />
            </el-tooltip>
            <el-tooltip content="编辑" placement="top">
              <el-button
                circle
                plain
                size="small"
                type="primary"
                :icon="Edit"
                @click="onEditArticle(row)"
              />
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button
                circle
                plain
                size="small"
                type="danger"
                :icon="Delete"
                @click="onDeleteArticle(row)"
              />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>

      <!-- 空状态 -->
      <template #empty>
        <el-empty description="暂无文章数据" :image-size="120">
          <el-button type="primary" @click="onAddArticle"
            >创建第一篇文章</el-button
          >
        </el-empty>
      </template>
    </el-table>

    <!-- 分页区域 -->
    <el-pagination
      v-model:current-page="params.pagenum"
      v-model:page-size="params.pagesize"
      :page-sizes="[2, 3, 5, 10]"
      :background="true"
      layout="jumper, total, sizes, prev, pager, next"
      :total="total"
      @size-change="onSizeChange"
      @current-change="onCurrentChange"
      style="margin-top: 20px; justify-content: flex-end"
    />

    <!-- 添加编辑的抽屉 -->
    <article-edit ref="articleEditRef" @success="onSuccess"></article-edit>

    <!-- 文章预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      :title="previewArticle.title"
      width="70%"
      center
    >
      <div class="preview-content">
        <div class="preview-meta">
          <el-tag type="info" size="small">{{
            previewArticle.cate_name
          }}</el-tag>
          <el-tag :type="getStateTagType(previewArticle.state)" size="small">
            {{ previewArticle.state }}
          </el-tag>
          <span class="preview-date">
            发布时间: {{ formatRelativeTime(previewArticle.pub_date) }}
          </span>
        </div>
        <el-divider />
        <div class="preview-article-content" v-html="previewArticle.content" />
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </page-container>
</template>

<style lang="scss" scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;

  .stats-info {
    display: flex;
    gap: 8px;
  }
}

.cover-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60px;

  .cover-image {
    width: 60px;
    height: 60px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      transform: scale(1.05);
      transition: transform 0.2s;
    }
  }

  .no-cover-icon {
    font-size: 24px;
    color: #c0c4cc;
  }
}

.article-info {
  .article-title {
    font-weight: 500;
    font-size: 16px;
    margin-bottom: 8px;

    .el-link {
      font-weight: inherit;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .article-preview {
    color: #666;
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .article-meta {
    display: flex;
    align-items: center;
    gap: 12px;

    .pub-date {
      color: #999;
      font-size: 12px;
    }
  }
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.preview-content {
  .preview-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .preview-date {
      color: #666;
      font-size: 14px;
      margin-left: auto;
    }
  }

  .preview-article-content {
    max-height: 400px;
    overflow-y: auto;
    padding: 16px;
    background: #fafafa;
    border-radius: 6px;
    line-height: 1.6;

    // 美化文章内容样式
    :deep(h1),
    :deep(h2),
    :deep(h3) {
      margin: 16px 0 8px;
      color: #333;
    }

    :deep(p) {
      margin: 8px 0;
      color: #666;
    }

    :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 8px 0;
    }

    :deep(code) {
      background: #f0f0f0;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
  }
}

// 表格样式优化
:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;

  .el-table__header-wrapper {
    .el-table__header {
      .el-table__cell {
        background: #f8f9fa;
        border-bottom: 2px solid #e9ecef;
        font-weight: 600;
        color: #495057;
      }
    }
  }

  .el-table__body-wrapper {
    .el-table__row {
      &:hover {
        background-color: #f8f9fa;
      }
    }
  }
}

// 分页样式
:deep(.el-pagination) {
  .el-pagination__total,
  .el-pagination__jump {
    color: #666;
  }
}
</style>
