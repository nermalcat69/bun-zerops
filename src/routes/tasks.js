import { Elysia } from 'elysia';
import { taskQueue } from '../config/queue.js';
import { pool } from '../config/database.js';
import { redis } from '../config/redis.js';

export const tasksRouter = new Elysia()
  // Root route with statistics
  .get('/', async () => {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority
      FROM tasks
    `);

    return {
      message: "Welcome to Task Manager API!",
      statistics: {
        total: parseInt(stats.rows[0].total),
        high: parseInt(stats.rows[0].high_priority),
        medium: parseInt(stats.rows[0].medium_priority),
        low: parseInt(stats.rows[0].low_priority)
      },
      usage: {
        create_task: {
          endpoint: "POST /tasks",
          example: `curl -X POST ${process.env.API_URL || 'http://localhost:3000'}/tasks \\
            -H "Content-Type: application/json" \\
            -d '{
              "title": "Important Task",
              "description": "Need to do this",
              "priority": "high"
            }'`
        },
        available_routes: [
          "GET /tasks - List all tasks",
          "GET /tasks/high - List high priority tasks",
          "GET /tasks/medium - List medium priority tasks",
          "GET /tasks/low - List low priority tasks",
          "GET /tasks/pending - List pending tasks",
          "GET /tasks/:id - Get task details",
          "GET /tasks/complete/:id - Complete a task"
        ]
      }
    };
  })
  .get('/tasks', async () => {
    const cacheKey = 'tasks';
    const cachedTasks = await redis.get(cacheKey);
    if (cachedTasks) {
      return JSON.parse(cachedTasks);
    }

    const result = await pool.query(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );
    const tasks = result.rows;

    await redis.set(cacheKey, JSON.stringify(tasks), 'EX', 300);
    return tasks;
  })
  .get('/tasks/high', async () => {
    const result = await pool.query(
      "SELECT * FROM tasks WHERE priority = 'high' ORDER BY created_at DESC"
    );
    return result.rows;
  })
  .get('/tasks/medium', async () => {
    const result = await pool.query(
      "SELECT * FROM tasks WHERE priority = 'medium' ORDER BY created_at DESC"
    );
    return result.rows;
  })
  .get('/tasks/low', async () => {
    const result = await pool.query(
      "SELECT * FROM tasks WHERE priority = 'low' ORDER BY created_at DESC"
    );
    return result.rows;
  })
  .get('/tasks/pending', async () => {
    const result = await pool.query(
      "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at DESC"
    );
    return result.rows;
  })
  .get('/tasks/:id', async ({ params }) => {
    const result = await pool.query(
      `SELECT t.*, json_agg(tl.* ORDER BY tl.created_at DESC) as logs
       FROM tasks t
       LEFT JOIN task_logs tl ON t.id = tl.task_id
       WHERE t.id = $1
       GROUP BY t.id`,
      [params.id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    return result.rows[0];
  })
  .post('/tasks', async ({ body }) => {
    if (!['low', 'medium', 'high'].includes(body.priority)) {
      throw new Error('Priority must be low, medium, or high');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO tasks (title, description, priority) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [body.title, body.description, body.priority]
      );
      
      await client.query(
        'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
        [result.rows[0].id, 'pending', 'Task created']
      );
      
      await taskQueue.add('process-task', {
        taskId: result.rows[0].id,
        ...body
      }, {
        priority: body.priority === 'high' ? 1 : body.priority === 'medium' ? 2 : 3,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });
      
      await client.query('COMMIT');
      await redis.del('tasks');
      
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
  .get('/tasks/complete/:id', async ({ params }) => {
    const result = await pool.query(
      `UPDATE tasks 
       SET status = 'completed'
       WHERE id = $1 
       RETURNING *`,
      [params.id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    await pool.query(
      'INSERT INTO task_logs (task_id, status, message) VALUES ($1, $2, $3)',
      [params.id, 'completed', 'Task marked as completed manually']
    );
    
    await redis.del('tasks');
    return result.rows[0];
  }); 