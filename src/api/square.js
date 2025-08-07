import request from '@/utils/request'

// 帖子相关接口

// 发布帖子
export const createPost = ({ title, content, cover_img = '' }) =>
  request.post('/my/square/post', { title, content, cover_img })

// 获取帖子列表
export const getPostList = ({ page = 1, pageSize = 10 } = {}) =>
  request.get('/my/square/posts', { params: { page, pageSize } })

// 获取帖子详情
export const getPostDetail = (id) => request.get(`/my/square/post/${id}`)

// 删除帖子
export const deletePost = (postId) =>
  request.post('/my/square/post/delete', { postId })

// 点赞相关接口

// 点赞帖子
export const likePost = (postId) => request.post('/my/square/like', { postId })

// 取消点赞
export const unlikePost = (postId) =>
  request.post('/my/square/unlike', { postId })

// 评论相关接口

// 添加评论
export const addComment = ({ postId, content, parentId = null }) =>
  request.post('/my/square/comment', { postId, content, parentId })

// 获取评论列表
export const getCommentList = (postId) =>
  request.get(`/my/square/comments/${postId}`)

// 删除评论
export const deleteComment = (commentId) =>
  request.post('/my/square/comment/delete', { commentId })
