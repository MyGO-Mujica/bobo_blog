<script setup>
import { ref } from 'vue'
import { Edit, Delete } from '@element-plus/icons-vue'
import {
  artGetChannelsService,
  artDelChannelService,
  artGetListService
} from '../../api/article'
import ChannelEdit from './components/ChannelEdit.vue'
import { formatRelativeTime } from '@/utils/format.js'
const channelList = ref([])
const loading = ref(false)
const dialog = ref()

const getChannelList = async () => {
  loading.value = true
  const res = await artGetChannelsService()
  channelList.value = res.data.data
  loading.value = false
}
getChannelList()

const onDelChannel = async (row) => {
  // 首先检查该分类下是否有文章
  try {
    const res = await artGetListService({
      pagenum: 1,
      pagesize: 1,
      cate_id: row.id
    })

    if (res.data.total > 0) {
      ElMessageBox.alert(
        `该分类下还有 ${res.data.total} 篇文章，无法删除。请先删除或移动这些文章到其他分类。`,
        '无法删除分类',
        {
          type: 'warning',
          confirmButtonText: '知道了'
        }
      )
      return
    }
  } catch (error) {
    console.error('检查分类文章失败:', error)
    ElMessage.error('检查分类状态失败，请稍后重试')
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
    console.error('删除分类失败:', error)
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
      <el-button @click="onAddChannel">添加分类</el-button>
    </template>

    <el-table v-loading="loading" :data="channelList" style="width: 100%">
      <el-table-column type="index" label="序号" width="100"></el-table-column>
      <el-table-column prop="cate_name" label="分类名称"></el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatRelativeTime(row.create_time) }}
        </template>
      </el-table-column>
      <el-table-column label="修改时间" width="180">
        <template #default="{ row }">
          {{ formatRelativeTime(row.update_time) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <!-- row 就是 channelList 的一项， $index 下标 -->
        <template #default="{ row, $index }">
          <el-button
            :icon="Edit"
            circle
            plain
            type="primary"
            @click="onEditChannel(row, $index)"
          ></el-button>
          <el-button
            :icon="Delete"
            circle
            plain
            type="danger"
            @click="onDelChannel(row, $index)"
          ></el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="没有数据"></el-empty>
      </template>
    </el-table>

    <channel-edit ref="dialog" @success="onSuccess"></channel-edit>
  </page-container>
</template>

<style lang="scss" scoped></style>
