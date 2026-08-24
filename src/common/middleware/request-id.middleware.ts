import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingId = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incomingId === 'string' && incomingId.length > 0 ? incomingId : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
};
