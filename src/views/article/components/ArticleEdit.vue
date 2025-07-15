<script setup>
import { ref, nextTick, computed } from 'vue'
import ChannelSelect from './ChannelSelect.vue'
import { Plus } from '@element-plus/icons-vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import {
  artPublishService,
  artGetDetailService,
  artEditService
} from '@/api/article'
import { baseURL } from '@/utils/request'
import axios from 'axios'

// 控制抽屉显示隐藏
const visibleDrawer = ref(false)

// 表单引用
const formRef = ref()

// 提交状态
const submitLoading = ref(false)

// 默认数据
const defaultForm = {
  title: '', // 标题
  cate_id: '', // 分类id
  cover_img: '', // 封面图片 file 对象
  content: '', // string 内容
  state: '' // 状态
}

// 准备数据
const formModel = ref({ ...defaultForm })

// 表单验证规则
const rules = {
  title: [
    { required: true, message: '请输入文章标题', trigger: 'blur' },
    { min: 1, max: 100, message: '标题长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  cate_id: [{ required: true, message: '请选择文章分类', trigger: 'change' }],
  cover_img: [{ required: true, message: '请上传文章封面', trigger: 'change' }],
  content: [
    { required: true, message: '请输入文章内容', trigger: 'blur' },
    { min: 10, message: '文章内容至少需要10个字符', trigger: 'blur' }
  ]
}

// 自定义验证器：验证图片文件
const validateCoverImg = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请上传文章封面图片'))
  } else if (value instanceof File) {
    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(value.type)) {
      callback(new Error('只支持 JPG、PNG、WEBP 格式的图片'))
    } else if (value.size > 5 * 1024 * 1024) {
      // 5MB
      callback(new Error('图片大小不能超过 5MB'))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

// 自定义验证器：验证文章内容
const validateContent = (rule, value, callback) => {
  if (!value || value.trim() === '' || value === '<p><br></p>') {
    callback(new Error('请输入文章内容'))
  } else {
    // 去除HTML标签后计算字符数
    const textContent = value.replace(/<[^>]*>/g, '').trim()
    if (textContent.length < 10) {
      callback(new Error('文章内容至少需要10个字符'))
    } else if (textContent.length > 50000) {
      callback(new Error('文章内容不能超过50000个字符'))
    } else {
      callback()
    }
  }
}

// 更新验证规则，使用自定义验证器
rules.cover_img = [{ validator: validateCoverImg, trigger: 'change' }]
rules.content = [{ validator: validateContent, trigger: 'blur' }]

// 字数统计
const contentLength = computed(() => {
  if (!formModel.value.content) return 0
  return formModel.value.content.replace(/<[^>]*>/g, '').trim().length
})

// 图片上传相关逻辑
const imgUrl = ref('')
const onSelectFile = (uploadFile) => {
  const file = uploadFile.raw

  // 验证文件类型
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('只支持 JPG、PNG、WEBP 格式的图片')
    return
  }

  // 验证文件大小 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB')
    return
  }

  imgUrl.value = URL.createObjectURL(file) // 预览图片
  formModel.value.cover_img = file // 将图片对象存入表单

  // 触发表单验证
  nextTick(() => {
    formRef.value?.validateField('cover_img')
  })
}

// 提交
const emit = defineEmits(['success'])
const onPublish = async (state) => {
  // 先进行表单验证
  try {
    await formRef.value.validate()
  } catch (error) {
    ElMessage.error('请完善表单信息')
    return
  }

  submitLoading.value = true

  try {
    // 将已发布还是草稿状态，存入 formModel
    formModel.value.state = state

    // 确保 cate_id 是数字类型
    if (formModel.value.cate_id !== '') {
      formModel.value.cate_id = Number(formModel.value.cate_id)
    }

    // 将普通对象 => 转换成 => formData对象
    const fd = new FormData()

    // 只添加后端需要的字段，避免发送不允许的字段
    const allowedFields = ['title', 'cate_id', 'cover_img', 'content', 'state']
    if (formModel.value.id) {
      allowedFields.push('id') // 编辑时需要 id
    }

    for (let key of allowedFields) {
      if (formModel.value[key] !== undefined && formModel.value[key] !== '') {
        fd.append(key, formModel.value[key])
      }
    }

    // 发请求
    if (formModel.value.id) {
      // 编辑操作
      await artEditService(fd)
      ElMessage.success('修改成功')
      // 提交成功后更新原始数据，避免关闭时提示未保存
      originalData.value = {
        title: formModel.value.title,
        cate_id: formModel.value.cate_id,
        content: formModel.value.content,
        cover_img: formModel.value.cover_img
      }
      visibleDrawer.value = false
      emit('success', 'edit')
    } else {
      // 添加操作
      await artPublishService(fd)
      ElMessage.success('添加成功')
      visibleDrawer.value = false
      // 通知到父组件，添加成功了
      emit('success', 'add')
    }
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('操作失败，请重试')
  } finally {
    submitLoading.value = false
  }
}

// 组件对外暴露一个方法 open，基于open传来的参数，区分添加还是编辑
// open({})  => 表单无需渲染，说明是添加
// open({ id, ..., ... })  => 表单需要渲染，说明是编辑
// open调用后，可以打开抽屉
const editorRef = ref()

// 重置表单
const resetForm = () => {
  formModel.value = { ...defaultForm }
  imgUrl.value = ''
  nextTick(() => {
    formRef.value?.clearValidate()
    if (editorRef.value && editorRef.value.setHTML) {
      editorRef.value.setHTML('')
    }
  })
}

// 保存初始数据用于比较
const originalData = ref({})

// 检查表单是否有未保存的更改
const hasUnsavedChanges = () => {
  // 如果是新建文章，只要有任何内容就算有更改
  if (!formModel.value.id) {
    return (
      formModel.value.title.trim() !== '' ||
      formModel.value.cate_id !== '' ||
      formModel.value.cover_img !== '' ||
      (formModel.value.content &&
        formModel.value.content.trim() !== '' &&
        formModel.value.content !== '<p><br></p>')
    )
  }

  // 如果是编辑文章，比较当前值与原始值
  return (
    formModel.value.title !== originalData.value.title ||
    formModel.value.cate_id !== originalData.value.cate_id ||
    formModel.value.content !== originalData.value.content ||
    // 对于图片，如果是新上传的File对象，说明有更改
    (formModel.value.cover_img instanceof File &&
      formModel.value.cover_img !== originalData.value.cover_img)
  )
}

// 关闭抽屉前确认
const handleClose = async () => {
  if (hasUnsavedChanges()) {
    try {
      await ElMessageBox.confirm('当前有未保存的更改，确定要关闭吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      visibleDrawer.value = false
      resetForm()
    } catch {
      // 用户取消关闭
    }
  } else {
    visibleDrawer.value = false
    resetForm()
  }
}

const open = async (row) => {
  visibleDrawer.value = true // 显示抽屉

  if (row.id) {
    // 需要基于 row.id 发送请求，获取编辑对应的详情数据，进行回显
    const res = await artGetDetailService(row.id)
    formModel.value = res.data.data

    // 保存原始数据用于比较
    originalData.value = {
      title: formModel.value.title || '',
      cate_id: formModel.value.cate_id || '',
      content: formModel.value.content || '',
      cover_img: formModel.value.cover_img || ''
    }

    // 图片需要单独处理回显
    if (formModel.value.cover_img) {
      imgUrl.value = baseURL + formModel.value.cover_img
      // 注意：提交给后台，需要的数据格式，是file对象格式
      // 需要将网络图片地址 => 转换成 file对象，存储起来, 将来便于提交
      const file = await imageUrlToFileObject(
        imgUrl.value,
        formModel.value.cover_img
      )
      formModel.value.cover_img = file
      // 更新原始数据中的cover_img为转换后的file对象
      originalData.value.cover_img = file
    }
  } else {
    // 新建文章时清空原始数据
    originalData.value = {}
    resetForm()
  }
}

// 将网络图片地址转换为 File 对象的函数
async function imageUrlToFileObject(imageUrl, filename) {
  try {
    // 使用 Axios 下载图片数据
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' })

    // 将下载的数据转换成 Blob 对象
    const blob = new Blob([response.data], {
      type: response.headers['content-type']
    })

    // 创建 File 对象
    const file = new File([blob], filename, {
      type: response.headers['content-type']
    })

    return file
  } catch (error) {
    console.error('Error converting image URL to File object:', error)
    return null
  }
}

defineExpose({
  open
})
</script>

<template>
  <el-drawer
    v-model="visibleDrawer"
    :title="formModel.id ? '编辑文章' : '添加文章'"
    direction="rtl"
    size="50%"
    :close-on-click-modal="false"
    :before-close="handleClose"
  >
    <!-- 发表文章表单 -->
    <el-form
      :model="formModel"
      :rules="rules"
      ref="formRef"
      label-width="100px"
      @submit.prevent
    >
      <el-form-item label="文章标题" prop="title">
        <el-input
          v-model="formModel.title"
          placeholder="请输入标题"
          maxlength="100"
          show-word-limit
          clearable
        />
      </el-form-item>

      <el-form-item label="文章分类" prop="cate_id">
        <channel-select
          v-model="formModel.cate_id"
          width="100%"
          placeholder="请选择文章分类"
        />
      </el-form-item>

      <el-form-item label="文章封面" prop="cover_img">
        <div class="upload-container">
          <el-upload
            class="avatar-uploader"
            :show-file-list="false"
            :auto-upload="false"
            :on-change="onSelectFile"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            drag
          >
            <img v-if="imgUrl" :src="imgUrl" class="avatar" />
            <div v-else class="upload-placeholder">
              <el-icon class="avatar-uploader-icon"><Plus /></el-icon>
              <div class="upload-text">
                <p>点击或拖拽图片到此处上传</p>
                <p class="upload-tip">
                  支持 JPG、PNG、WEBP 格式，大小不超过 5MB
                </p>
              </div>
            </div>
          </el-upload>
        </div>
      </el-form-item>

      <el-form-item label="文章内容" prop="content">
        <div class="editor-container">
          <div class="editor-header">
            <span class="word-count">字数: {{ contentLength }}</span>
          </div>
          <div class="editor">
            <quill-editor
              ref="editorRef"
              v-model:content="formModel.content"
              content-type="html"
              theme="snow"
              placeholder="请输入文章内容..."
              @blur="() => formRef?.validateField('content')"
            />
          </div>
        </div>
      </el-form-item>

      <el-form-item>
        <div class="submit-buttons">
          <el-button
            @click="onPublish('已发布')"
            type="primary"
            :loading="submitLoading"
            :disabled="submitLoading"
          >
            {{ submitLoading ? '发布中...' : '发布' }}
          </el-button>
          <el-button
            @click="onPublish('草稿')"
            type="info"
            :loading="submitLoading"
            :disabled="submitLoading"
          >
            {{ submitLoading ? '保存中...' : '保存草稿' }}
          </el-button>
        </div>
      </el-form-item>
    </el-form>
  </el-drawer>
</template>

<style lang="scss" scoped>
.upload-container {
  width: 100%;

  .avatar-uploader {
    :deep(.el-upload) {
      border: 2px dashed var(--el-border-color);
      border-radius: 5px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: var(--el-transition-duration-fast);
      width: 100%;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        border-color: var(--el-color-primary);
      }

      &.is-dragover {
        border-color: var(--el-color-primary);
        background-color: var(--el-color-primary-light-9);
      }
    }

    .avatar {
      width: 100%;
      height: 200px;
      display: block;
      object-fit: cover;
      border-radius: 6px;
    }

    .upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--el-text-color-secondary);

      .avatar-uploader-icon {
        font-size: 32px;
        margin-bottom: 12px;
      }

      .upload-text {
        text-align: center;

        p {
          margin: 4px 0;
        }

        .upload-tip {
          font-size: 12px;
          color: var(--el-text-color-placeholder);
        }
      }
    }
  }
}

.editor-container {
  width: 100%;

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .word-count {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .editor {
    width: 100%;

    :deep(.ql-editor) {
      min-height: 300px;
      font-size: 14px;
      line-height: 1.6;
    }

    :deep(.ql-toolbar) {
      border-top: 1px solid var(--el-border-color);
      border-left: 1px solid var(--el-border-color);
      border-right: 1px solid var(--el-border-color);
    }

    :deep(.ql-container) {
      border-bottom: 1px solid var(--el-border-color);
      border-left: 1px solid var(--el-border-color);
      border-right: 1px solid var(--el-border-color);
    }
  }
}

.submit-buttons {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
  margin-top: 20px;
}

// 表单样式优化
:deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

:deep(.el-form-item__error) {
  font-size: 12px;
}

// 抽屉样式优化
:deep(.el-drawer__header) {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .el-drawer__title {
    font-size: 18px;
    font-weight: 600;
  }
}

:deep(.el-drawer__body) {
  padding: 20px;
}
</style>
