import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFound(_request: Request, response: Response) {
  return response.status(404).json({ error: 'Route not found.' });
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) return response.status(400).json({ error: 'Invalid request data.', details: error.flatten() });
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error.' });
}
