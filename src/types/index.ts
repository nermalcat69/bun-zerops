export interface User {
  id: number;
  email: string;
  password: string;
  created_at: Date;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  due_date: Date;
  created_at: Date;
  updated_at: Date;
}

export interface TaskCreate {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  due_date: Date;
} 