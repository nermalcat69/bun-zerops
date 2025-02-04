import { Elysia } from 'elysia';
import { taskQueue } from '../config/queue';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { taskSchema } from '../validators/schema';
import { auth } from '../middleware/auth';

export const tasksRouter = new Elysia()
  .use(auth)
  .get('/tasks', async ({ getCurrentUser }) => {
    const user = await getCurrentUser();
    
    // Try to get from cache first
    const cacheKey = `tasks:${user.userId}`;
    const cachedTasks = await redis.get(cacheKey);
    if (cachedTasks) {
      return JSON.parse(cachedTasks);
    }

    // If not in cache, get from database
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [user.userId]
    );
    const tasks = result.rows;

    // Store in cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(tasks), 'EX', 300);

    return tasks;
  })
  .get('/tasks/:id', async ({ params, getCurrentUser }) => {
    const user = await getCurrentUser();
    
    const result = await pool.query(
      `SELECT t.*, 
        json_agg(tl.* ORDER BY tl.created_at DESC) as logs
       FROM tasks t
       LEFT JOIN task_logs tl ON t.id = tl.task_id
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id`,
      [params.id, user.userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    return result.rows[0];
  })
  .post('/tasks', async ({ body, getCurrentUser }) => {
    const user = await getCurrentUser();
    const taskData = taskSchema.parse(body);
    
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create task
      const result = await client.query(
        `INSERT INTO tasks 
         (user_id, title, description, priority, due_date) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [user.userId, taskData.title, taskData.description, taskData.priority, taskData.due_date]
      );
      
      // Create initial log
      await client.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [result.rows[0].id, 'pending', 'Task created']
      );
      
      // Add to processing queue
      await taskQueue.add('process-task', {
        taskId: result.rows[0].id,
        ...taskData
      }, {
        priority: taskData.priority === 'high' ? 1 : taskData.priority === 'medium' ? 2 : 3,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });
      
      await client.query('COMMIT');
      
      // Clear cache
      await redis.del(`tasks:${user.userId}`);
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
  .delete('/tasks/:id', async ({ params, getCurrentUser }) => {
    const user = await getCurrentUser();
    
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
      [params.id, user.userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    // Clear cache
    await redis.del(`tasks:${user.userId}`);
    
    return { message: 'Task deleted successfully' };
  }); 