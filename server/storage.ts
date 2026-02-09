import Redis from "ioredis";

interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class InMemoryStore implements Store {
  private data = new Map<string, { value: string; expiry?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const entry: { value: string; expiry?: number } = { value };
    if (ttlSeconds) {
      entry.expiry = Date.now() + ttlSeconds * 1000;
    }
    this.data.set(key, entry);
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

class RedisStore implements Store {
  private client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });

    this.client.on("error", (err) => {
      console.error("Redis error:", err);
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

// Export a singleton store instance
export const store: Store =
  process.env.NODE_ENV === "production" && process.env.REDIS_URL
    ? new RedisStore(process.env.REDIS_URL)
    : new InMemoryStore();

console.log(
  `Using ${store instanceof RedisStore ? "Redis" : "in-memory"} storage`,
);
