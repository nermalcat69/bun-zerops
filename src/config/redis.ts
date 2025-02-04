import { Redis } from 'ioredis';
import { env } from 'bun';

export const redis = new Redis(env.REDIS_URL); 