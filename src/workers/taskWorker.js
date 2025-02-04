import { Worker, Queue } from 'bullmq';
import { redis } from '../config/redis.js';
import { pool } from '../config/database.js';

// Create a queue for scheduled checks
const scheduledQueue = new Queue('scheduled-tasks', {
  connection: {
    url: process.env.REDIS_URL,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  }
});

// Worker for processing tasks
const worker = new Worker(
  'tasks',
  async (job) => {
    console.log(`Processing job ${job.id}`);
    
    try {
      // Check if task has expired
      const result = await pool.query(
        'SELECT * FROM tasks WHERE id = $1',
        [job.data.taskId]
      );
      
      const task = result.rows[0];
      
      // Process the task
      await pool.query(
        'UPDATE tasks SET status = $1 WHERE id = $2',
        ['in_progress', task.id]
      );

      await pool.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [task.id, 'in_progress', 'Processing started']
      );

      // Simulate processing
      await simulateProcessing();

      // Mark as completed
      await pool.query(
        'UPDATE tasks SET status = $1 WHERE id = $2',
        ['completed', task.id]
      );

      await pool.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [task.id, 'completed', 'Task completed successfully']
      );

      await redis.del('tasks');
      return { status: 'completed', taskId: task.id };
    } catch (error) {
      await handleError(job.data.taskId, error);
      throw error;
    }
  },
  {
    connection: {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    },
    concurrency: 5
  }
);

// Check for expired tasks every minute
setInterval(async () => {
  const result = await pool.query(
    `UPDATE tasks 
     SET status = 'expired' 
     WHERE status IN ('pending', 'in_progress') 
     AND expires_at < NOW() 
     RETURNING id`
  );

  for (const task of result.rows) {
    await pool.query(
      'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
      [task.id, 'expired', 'Task expired after 24 hours']
    );
  }

  if (result.rows.length > 0) {
    await redis.del('tasks');
  }
}, 60000);

async function simulateProcessing() {
  const processingTime = Math.random() * 5000;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  if (Math.random() < 0.1) {
    throw new Error('Random processing error');
  }
}

async function handleError(taskId, error) {
  await pool.query(
    'UPDATE tasks SET status = $1 WHERE id = $2',
    ['failed', taskId]
  );

  await pool.query(
    'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
    [taskId, 'failed', error.message]
  );
}

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
}); 