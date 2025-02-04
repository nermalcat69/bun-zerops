import { Queue } from 'bullmq';
import { redis } from './redis';

export const taskQueue = new Queue('tasks', {
  connection: redis,
}); 