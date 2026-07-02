import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import Redis from "ioredis"

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client!: Redis
  private subClient!: Redis
  private isConnected = false

  // Fallback in-memory store khi Redis server không khả dụng
  private readonly memoryStore = new Map<string, string>()
  private readonly localSubscribers = new Map<
    string,
    Set<(message: string) => void>
  >()

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>("REDIS_URL") as string

    const commonOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.warn(
            `Redis connection failed after ${times} attempts. Falling back to in-memory mode.`,
          )
          this.isConnected = false
          return null // Ngừng reconnect, chuyển sang fallback
        }
        return Math.min(times * 1000, 3000)
      },
    }

    try {
      this.client = new Redis(redisUrl, commonOptions)
      this.subClient = new Redis(redisUrl, commonOptions)

      this.client.on("connect", () => {
        this.isConnected = true
        this.logger.log("🔌 Connected to Redis for commands")
      })

      this.client.on("error", (err) => {
        this.logger.error(`Redis command client error: ${err.message}`)
        this.isConnected = false
      })

      this.subClient.on("connect", () => {
        this.logger.log("🔌 Connected to Redis for subscriptions")
      })

      this.subClient.on("error", (err) => {
        this.logger.error(`Redis sub client error: ${err.message}`)
      })

      // Lắng nghe message từ Redis subClient
      this.subClient.on("message", (channel, message) => {
        const callbacks = this.localSubscribers.get(channel)
        if (callbacks) {
          callbacks.forEach((cb) => cb(message))
        }
      })
    } catch (e: any) {
      this.logger.warn(
        `Could not initialize Redis client: ${e.message}. Using in-memory fallback.`,
      )
      this.isConnected = false
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {})
    }
    if (this.subClient) {
      await this.subClient.quit().catch(() => {})
    }
  }

  // ── COMMANDS ──

  async get(key: string): Promise<string | null> {
    if (this.isConnected) {
      try {
        return await this.client.get(key)
      } catch (e: any) {
        this.logger.warn(
          `Redis get failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }
    return this.memoryStore.get(key) || null
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.isConnected) {
      try {
        if (ttlSeconds) {
          await this.client.set(key, value, "EX", ttlSeconds)
        } else {
          await this.client.set(key, value)
        }
        return
      } catch (e: any) {
        this.logger.warn(
          `Redis set failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }

    this.memoryStore.set(key, value)
    if (ttlSeconds) {
      setTimeout(() => {
        this.memoryStore.delete(key)
      }, ttlSeconds * 1000)
    }
  }

  async del(key: string): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.del(key)
        return
      } catch (e: any) {
        this.logger.warn(
          `Redis del failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }
    this.memoryStore.delete(key)
  }

  // ── HASH COMMANDS (dùng cho Presence Store) ──

  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.isConnected) {
      try {
        return await this.client.hgetall(key)
      } catch (e: any) {
        this.logger.warn(
          `Redis hgetall failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }

    const result: Record<string, string> = {}
    const prefix = `${key}:`
    for (const [mKey, mVal] of this.memoryStore.entries()) {
      if (mKey.startsWith(prefix)) {
        const field = mKey.substring(prefix.length)
        result[field] = mVal
      }
    }
    return result
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.hset(key, field, value)
        return
      } catch (e: any) {
        this.logger.warn(
          `Redis hset failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }
    this.memoryStore.set(`${key}:${field}`, value)
  }

  async hdel(key: string, field: string): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.hdel(key, field)
        return
      } catch (e: any) {
        this.logger.warn(
          `Redis hdel failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }
    this.memoryStore.delete(`${key}:${field}`)
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (this.isConnected) {
      try {
        return await this.client.hget(key, field)
      } catch (e: any) {
        this.logger.warn(
          `Redis hget failed: ${e.message}. Using in-memory fallback.`,
        )
      }
    }
    return this.memoryStore.get(`${key}:${field}`) ?? null
  }

  // ── PUB/SUB ──

  async publish(channel: string, message: string): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.publish(channel, message)
        return
      } catch (e: any) {
        this.logger.warn(
          `Redis publish failed: ${e.message}. Emitting locally.`,
        )
      }
    }

    // Fallback: emit locally
    const callbacks = this.localSubscribers.get(channel)
    if (callbacks) {
      callbacks.forEach((cb) => cb(message))
    }
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    let callbacks = this.localSubscribers.get(channel)
    if (!callbacks) {
      callbacks = new Set()
      this.localSubscribers.set(channel, callbacks)
    }
    callbacks.add(callback)

    if (this.isConnected) {
      try {
        await this.subClient.subscribe(channel)
      } catch (e: any) {
        this.logger.warn(
          `Redis subscribe failed: ${e.message}. Using in-memory subscription only.`,
        )
      }
    }
  }
}
