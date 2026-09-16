declare global {
  namespace Express {
    interface Request {
      userId?: string;
      adminRole?: 'super_admin' | 'operator' | 'viewer';
    }
  }
}

export {};
