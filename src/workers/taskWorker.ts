import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { pool } from '../config/database';

const worker = new Worker(
  'tasks',
  async (job) => {
    console.log(`Processing job ${job.id}`);
    
    try {
      // Update task status to processing
      await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
        ['processing', job.data.taskId]
      );

      // Log the status change
      await pool.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [job.data.taskId, 'processing', 'Task processing started']
      );

      // Simulate some complex processing
      await simulateProcessing(job.data);

      // Update task status to completed
      await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
        ['completed', job.data.taskId]
      );

      // Log completion
      await pool.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [job.data.taskId, 'completed', 'Task completed successfully']
      );

      // Clear cache
      await redis.del('tasks');

      return { success: true, taskId: job.data.taskId };
    } catch (error) {
      // Update task status to failed
      await pool.query(
        'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
        ['failed', job.data.taskId]
      );

      // Log error
      await pool.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [job.data.taskId, 'failed', error.message]
      );

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 1000,
      duration: 5000
    }
  }
);

async function simulateProcessing(data: any) {
  const processingTime = Math.random() * 5000; // Random processing time up to 5 seconds
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  if (Math.random() < 0.1) { // 10% chance of failure
    throw new Error('Random processing error');
  }
}

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
}); 