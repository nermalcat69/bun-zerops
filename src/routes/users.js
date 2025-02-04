import { Elysia } from 'elysia';
import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';

export const userRouter = new Elysia()
  .post('/register', async ({ body }) => {
    const { email, password } = body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, hashedPassword]
    );
    
    return result.rows[0];
  })
  .post('/login', async ({ jwt, body }) => {
    const { email, password } = body;
    
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new Error('Invalid credentials');
    }
    
    const token = await jwt.sign({
      userId: user.id,
      email: user.email
    });
    
    return { token };
  }); 