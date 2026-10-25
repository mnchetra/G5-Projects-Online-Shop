import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function asyncHandler(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    res.status(error.status).json({ success: false, error: { message: error.message } });
    return;
  }
  if (error instanceof MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ success: false, error: { message: error.code === 'LIMIT_FILE_SIZE' ? 'Image size must be 5 MB or less' : 'Image upload was rejected' } });
    return;
  }
  if (error instanceof Error && error.name === 'ZodError') {
    res.status(400).json({ success: false, error: { message: 'Invalid request data', details: error } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === 'P2025' ? 404 : error.code === 'P2002' || error.code === 'P2003' || error.code === 'P2034' ? 409 : 500;
    const message = error.code === 'P2025' ? 'Record not found' : error.code === 'P2002' ? 'A record with these details already exists' : error.code === 'P2034' ? 'The record changed during this request; retry it' : error.code === 'P2003' ? 'This record is still in use' : 'Database request failed';
    res.status(status).json({ success: false, error: { message } });
    return;
  }
  console.error(error);
  res.status(500).json({ success: false, error: { message: 'Internal server error' } });
}

export function success<T>(data: T) {
  return { success: true, data };
}