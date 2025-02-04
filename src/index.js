import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { tasksRouter } from './routes/tasks.js';

const app = new Elysia()
  .use(cors())
  .onError(({ code, error, set }) => {
    switch (code) {
      case 'VALIDATION':
        set.status = 400;
        return { error: 'Validation error', details: error.message };
      case 'NOT_FOUND':
        set.status = 404;
        return { error: 'Not found' };
      default:
        set.status = 500;
        console.error(error);
        return { error: 'Internal server error' };
    }
  })
  .use(tasksRouter)
  .listen(process.env.PORT || 3000);

console.log(`🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`); 