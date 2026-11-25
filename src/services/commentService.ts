import { authorizedRequest as requestWithAuth } from './api'

/** HU-25: comentario (principal o respuesta) tal como lo devuelve el backend. */
export interface CommentReply {
  id: string
  author: { id: string; name: string }
  isOwn: boolean
  content: string
  createdAt: string
  updatedAt: string | null
}

export interface CommentThread extends CommentReply {
  selection: { start: number | null; end: number | null }
  quotedText: string | null
  resolved: boolean
  resolvedAt: string | null
  replies: CommentReply[]
}

export interface NewCommentRequest {
  content: string
  selectionStart: number
  selectionEnd: number
  quotedText: string
}

export async function getCommentThreads(documentId: string): Promise<CommentThread[]> {
  const response = await requestWithAuth<{ threads: CommentThread[] }>(`/documents/${documentId}/comments`)
  return response.threads || []
}

export async function createCommentThread(documentId: string, data: NewCommentRequest): Promise<CommentThread> {
  const response = await requestWithAuth<{ thread: CommentThread }>(`/documents/${documentId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.thread
}

export async function replyToComment(threadId: string, content: string): Promise<CommentReply> {
  const response = await requestWithAuth<{ reply: CommentReply }>(`/comments/${threadId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  return response.reply
}

export async function editComment(commentId: string, content: string): Promise<void> {
  await requestWithAuth(`/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ content }) })
}

export async function setCommentResolved(threadId: string, resolved: boolean): Promise<void> {
  await requestWithAuth(`/comments/${threadId}/${resolved ? 'resolve' : 'reopen'}`, { method: 'POST' })
}

export async function deleteComment(commentId: string): Promise<void> {
  await requestWithAuth(`/comments/${commentId}`, { method: 'DELETE' })
}
