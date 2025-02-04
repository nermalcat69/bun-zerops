import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';

export const auth = new Elysia()
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET || 'your-secret-key',
  }))
  .use(bearer())
  .derive(({ jwt, bearer }) => ({
    getCurrentUser: async () => {
      if (!bearer) throw new Error('Unauthorized');
      const payload = await jwt.verify(bearer);
      if (!payload) throw new Error('Invalid token');
      return payload;
    }
  })); 