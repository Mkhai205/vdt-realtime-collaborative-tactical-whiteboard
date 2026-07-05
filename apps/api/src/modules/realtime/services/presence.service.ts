import { Injectable, Logger } from "@nestjs/common"
import {
  type OnlineUser,
  type UserSummary,
  type EffectiveBoardRole,
} from "@rctw/shared-contracts"
import { RedisService } from "../../../infrastructure/redis/redis.service"

// Cấu trúc lưu trong Redis editing store
export type EditingStateEntry = {
  objectId: string
  user: UserSummary
  socketId: string
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name)

  // Local set of all active socket IDs connected to this server instance
  private readonly activeSockets = new Set<string>()

  // Local mapping để tối ưu hóa việc dọn dẹp khi socket disconnect:
  // socketId -> Set<boardId> (do một socket connection chỉ thuộc về một node instance)
  private readonly socketBoards = new Map<string, Set<string>>()

  // Local mapping để track user details của từng socket
  private readonly socketUsers = new Map<string, UserSummary>()

  // Local mapping để track objects đang được edit bởi socket nào:
  // socketId -> Map<boardId, Set<objectId>>
  private readonly socketEditing = new Map<string, Map<string, Set<string>>>()

  constructor(private readonly redis: RedisService) {}

  addActiveSocket(socketId: string): void {
    this.activeSockets.add(socketId)
  }

  removeActiveSocket(socketId: string): void {
    this.activeSockets.delete(socketId)
  }

  /**
   * User tham gia vào board
   */
  async joinBoard(params: {
    socketId: string
    boardId: string
    user: UserSummary
    effectiveRole: EffectiveBoardRole
  }): Promise<OnlineUser[]> {
    const { socketId, boardId, user, effectiveRole } = params

    // Add to active sockets
    this.activeSockets.add(socketId)

    // Clean up stale presence entries on this board in Redis
    const presenceKey = this.getPresenceKey(boardId)
    try {
      const rawData = await this.redis.hgetall(presenceKey)
      for (const sId of Object.keys(rawData)) {
        if (!this.activeSockets.has(sId)) {
          await this.redis.hdel(presenceKey, sId)
          this.logger.log(`🧹 Cleaned up stale presence socket ${sId} from Redis`)
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to clean up stale presence keys: ${err.message}`)
    }

    const onlineUser: OnlineUser = {
      ...user,
      effectiveRole,
      role: effectiveRole,
    }

    await this.redis.hset(presenceKey, socketId, JSON.stringify(onlineUser))

    // Lưu local tracking
    let boards = this.socketBoards.get(socketId)
    if (!boards) {
      boards = new Set()
      this.socketBoards.set(socketId, boards)
    }
    boards.add(boardId)
    this.socketUsers.set(socketId, user)

    return this.getOnlineUsers(boardId)
  }

  /**
   * User rời khỏi board
   */
  async leaveBoard(socketId: string, boardId: string): Promise<void> {
    const presenceKey = this.getPresenceKey(boardId)
    await this.redis.hdel(presenceKey, socketId)

    const boards = this.socketBoards.get(socketId)
    if (boards) {
      boards.delete(boardId)
      if (boards.size === 0) {
        this.socketBoards.delete(socketId)
        this.socketUsers.delete(socketId)
      }
    }
  }

  /**
   * Lấy danh sách users online trong board
   */
  async getOnlineUsers(boardId: string): Promise<OnlineUser[]> {
    const presenceKey = this.getPresenceKey(boardId)
    const rawData = await this.redis.hgetall(presenceKey)

    const users: OnlineUser[] = []
    // Remove duplicate users (nếu một user connect nhiều tab/socket)
    const seenUserIds = new Set<string>()

    for (const raw of Object.values(rawData)) {
      try {
        const user = JSON.parse(raw) as OnlineUser
        if (!seenUserIds.has(user.id)) {
          seenUserIds.add(user.id)
          users.push(user)
        }
      } catch (err) {
        this.logger.error(`Error parsing presence user: ${String(err)}`)
      }
    }

    return users
  }

  /**
   * Kiểm tra socket có trong board không
   */
  async hasSocketInBoard(socketId: string, boardId: string): Promise<boolean> {
    const boards = this.socketBoards.get(socketId)
    return boards ? boards.has(boardId) : false
  }

  /**
   * Kiểm tra xem object có đang bị khóa (chỉnh sửa) bởi một socket khác hay không
   */
  async isLockedByOther(
    boardId: string,
    objectId: string,
    socketId: string,
  ): Promise<boolean> {
    const editingKey = this.getEditingKey(boardId)
    const raw = await this.redis.hget(editingKey, objectId)
    if (!raw) return false
    try {
      const entry = JSON.parse(raw) as EditingStateEntry
      return entry.socketId !== socketId
    } catch {
      return false
    }
  }

  // ── Editing State (Awareness) ──

  /**
   * Đánh dấu socket đang edit một object, ghi vào Redis để chia sẻ cross-instance
   */
  async setEditing(
    socketId: string,
    boardId: string,
    objectId: string,
    user: UserSummary,
  ): Promise<void> {
    // Cập nhật local tracking
    let editingMap = this.socketEditing.get(socketId)
    if (!editingMap) {
      editingMap = new Map()
      this.socketEditing.set(socketId, editingMap)
    }

    let objects = editingMap.get(boardId)
    if (!objects) {
      objects = new Set()
      editingMap.set(boardId, objects)
    }
    objects.add(objectId)

    // Ghi vào Redis (editing:boardId -> objectId -> JSON{user, socketId})
    const editingKey = this.getEditingKey(boardId)
    const entry: EditingStateEntry = { objectId, user, socketId }
    await this.redis.hset(editingKey, objectId, JSON.stringify(entry))
  }

  /**
   * Xóa đánh dấu socket đang edit một object, xóa khỏi Redis
   */
  async clearEditing(
    socketId: string,
    boardId: string,
    objectId: string,
  ): Promise<void> {
    // Cập nhật local tracking
    const editingMap = this.socketEditing.get(socketId)
    if (editingMap) {
      const objects = editingMap.get(boardId)
      if (objects) {
        objects.delete(objectId)
        if (objects.size === 0) {
          editingMap.delete(boardId)
        }
      }
      if (editingMap.size === 0) {
        this.socketEditing.delete(socketId)
      }
    }

    // Xóa khỏi Redis — chỉ xóa nếu đúng socketId đang hold lock
    const editingKey = this.getEditingKey(boardId)
    const raw = await this.redis.hget(editingKey, objectId)
    if (raw) {
      try {
        const entry = JSON.parse(raw) as EditingStateEntry
        if (entry.socketId === socketId) {
          await this.redis.hdel(editingKey, objectId)
        }
      } catch {
        // Nếu parse lỗi thì xóa luôn để an toàn
        await this.redis.hdel(editingKey, objectId)
      }
    }
  }

  /**
   * Lấy toàn bộ trạng thái editing của một board từ Redis
   * Dùng khi client join board để nhận trạng thái hiện tại
   */
  async getEditingStates(
    boardId: string,
  ): Promise<Array<{ objectId: string; user: UserSummary }>> {
    const editingKey = this.getEditingKey(boardId)
    const rawData = await this.redis.hgetall(editingKey)

    const result: Array<{ objectId: string; user: UserSummary }> = []

    for (const [objId, raw] of Object.entries(rawData)) {
      try {
        const entry = JSON.parse(raw) as EditingStateEntry

        // If the socket holding the editing lock is no longer active, clean it up!
        if (!this.activeSockets.has(entry.socketId)) {
          await this.redis.hdel(editingKey, objId)
          this.logger.log(`🧹 Cleaned up stale editing lock on object ${objId} from Redis`)
          continue
        }

        result.push({ objectId: entry.objectId, user: entry.user })
      } catch (err) {
        this.logger.error(`Error parsing editing state: ${String(err)}`)
      }
    }

    return result
  }

  /**
   * Dọn dẹp các object đang edit của socket trên một board cụ thể.
   * Trả về danh sách objects đã ngừng edit kèm theo user summary.
   */
  clearEditingForSocketBoard(
    socketId: string,
    boardId: string,
  ): Array<{ boardId: string; objectId: string; user: UserSummary }> {
    const user = this.socketUsers.get(socketId)
    if (!user) return []

    const result: Array<{
      boardId: string
      objectId: string
      user: UserSummary
    }> = []

    const editingMap = this.socketEditing.get(socketId)
    if (editingMap) {
      const objects = editingMap.get(boardId)
      if (objects) {
        for (const objId of objects) {
          result.push({ boardId, objectId: objId, user })
        }
        editingMap.delete(boardId)
      }
      if (editingMap.size === 0) {
        this.socketEditing.delete(socketId)
      }
    }

    return result
  }

  /**
   * Dọn dẹp toàn bộ dữ liệu của socket khi ngắt kết nối.
   * Trả về danh sách các boards bị ảnh hưởng và online users mới của từng board,
   * cùng với các objects vừa ngừng edit.
   */
  async clearAllForSocket(socketId: string): Promise<{
    affectedBoards: Array<{ boardId: string; onlineUsers: OnlineUser[] }>
    endedEditingStates: Array<{
      boardId: string
      objectId: string
      user: UserSummary
    }>
  }> {
    this.activeSockets.delete(socketId)
    const user = this.socketUsers.get(socketId)
    const boards = this.socketBoards.get(socketId)
    const affectedBoards: Array<{
      boardId: string
      onlineUsers: OnlineUser[]
    }> = []
    const endedEditingStates: Array<{
      boardId: string
      objectId: string
      user: UserSummary
    }> = []

    if (boards && user) {
      for (const boardId of boards) {
        // Xóa presence trong Redis
        const presenceKey = this.getPresenceKey(boardId)
        await this.redis.hdel(presenceKey, socketId)

        // Lấy online users mới
        const onlineUsers = await this.getOnlineUsers(boardId)
        affectedBoards.push({ boardId, onlineUsers })

        // Clear editing states trên board này (local tracking)
        const editingStates = this.clearEditingForSocketBoard(socketId, boardId)
        endedEditingStates.push(...editingStates)

        // Xóa các editing states này khỏi Redis
        for (const state of editingStates) {
          const editingKey = this.getEditingKey(boardId)
          // Chỉ xóa nếu đúng socketId đang hold lock
          const raw = await this.redis.hget(editingKey, state.objectId)
          if (raw) {
            try {
              const entry = JSON.parse(raw) as EditingStateEntry
              if (entry.socketId === socketId) {
                await this.redis.hdel(editingKey, state.objectId)
              }
            } catch {
              await this.redis.hdel(editingKey, state.objectId)
            }
          }
        }
      }
    }

    // Dọn dẹp local mappings
    this.socketBoards.delete(socketId)
    this.socketUsers.delete(socketId)
    this.socketEditing.delete(socketId)

    return { affectedBoards, endedEditingStates }
  }

  private getPresenceKey(boardId: string): string {
    return `presence:${boardId}`
  }

  private getEditingKey(boardId: string): string {
    return `editing:${boardId}`
  }
}
