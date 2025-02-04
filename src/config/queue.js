import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const taskQueue = new Queue('tasks', {
  connection: redis,
}); 