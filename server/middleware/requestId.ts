import { nanoid } from "nanoid";
import type { Request, Response, NextFunction } from "express";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

// Adds a correlation/request ID to each incoming request and exposes it in a header.
export function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const existing = req.headers["x-request-id"]; // allow upstream to pass-through
  const requestId = (Array.isArray(existing) ? existing[0] : existing) || nanoid();
  req.requestId = requestId as string;
  res.setHeader("x-request-id", req.requestId);
  next();
}
