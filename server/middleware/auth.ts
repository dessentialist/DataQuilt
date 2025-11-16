import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/database";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logWarn } from "@shared/logger";
import { ERROR_CATALOG } from "@shared/errors";

// Authentication middleware for Supabase-only auth model
// - Server trusts Supabase access tokens sent by the client.
// - We verify the token locally with SUPABASE_JWT_SECRET.
// - No server-minted cookies or tokens are used anywhere in this app.

// Dynamic function to get JWT secret (allows for test environment variable changes)
function getSupabaseJwtSecret(): string | undefined {
  return process.env.SUPABASE_JWT_SECRET;
}

// Check if JWT secret is available (but don't fail fast in test environment)
const SUPABASE_JWT_SECRET = getSupabaseJwtSecret();
if (!SUPABASE_JWT_SECRET && process.env.NODE_ENV !== 'test') {
  // Fail fast on boot when secret is missing to avoid accepting any request.
  // eslint-disable-next-line no-console
  console.error("[auth] Missing SUPABASE_JWT_SECRET environment variable");
}

// Express request with optional user attached by this middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
  };
}

/**
 * authenticateSupabaseUser
 * - Extracts Authorization: Bearer <access_token>
 * - Verifies the JWT using SUPABASE_JWT_SECRET
 * - Loads the application user from DB and attaches to req.user
 * - On failure, responds with 401 and a reason code for observability
 */
/**
 * authenticateSupabaseUser
 * Extracts and verifies `Authorization: Bearer <token>` using SUPABASE_JWT_SECRET.
 * On success attaches `{ userId, email? }` to `req.user`.
 * On failure responds 401 with a stable reason code for observability.
 */
export async function authenticateSupabaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    // Enhanced debugging for authentication middleware
    console.log("AUTH MIDDLEWARE DEBUG:", {
      path: req.path,
      method: req.method,
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader ? `${authHeader.substring(0, 20)}...` : null,
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : null,
      requestId: req.requestId,
    });

    if (!token) {
      const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
      logWarn("auth_missing_token", {
        path: req.path,
        method: req.method,
        requestId: req.requestId,
      });
      console.log("AUTH MIDDLEWARE: No token found, returning 401");
      return res.status(spec.httpStatus).json({
        message: spec.defaultMessage,
        code: "AUTH_MISSING_TOKEN",
        requestId: req.requestId,
      });
    }

    const jwtSecret = getSupabaseJwtSecret();
    if (!jwtSecret) {
      const spec = ERROR_CATALOG.SERVER_MISCONFIGURED;
      return res.status(spec.httpStatus).json({
        message: spec.defaultMessage,
        code: "SERVER_MISCONFIGURED",
        requestId: req.requestId,
      });
    }

    const { userId, email } = verifySupabaseToken(token, jwtSecret);

    if (!userId) {
      const spec = ERROR_CATALOG.AUTH_NO_SUB;
      logWarn("auth_no_sub", { path: req.path, requestId: req.requestId });
      return res
        .status(spec.httpStatus)
        .json({ message: spec.defaultMessage, code: "AUTH_NO_SUB", requestId: req.requestId });
    }

    // Verify user exists in database (created by /api/auth/sync on client login)
    const userRows = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
    if (!userRows.length) {
      const spec = ERROR_CATALOG.AUTH_USER_NOT_FOUND;
      logWarn("auth_user_not_found", { path: req.path, userId, requestId: req.requestId });
      return res.status(spec.httpStatus).json({
        message: spec.defaultMessage,
        code: "AUTH_USER_NOT_FOUND",
        requestId: req.requestId,
      });
    }

    req.user = { userId, email };
    next();
  } catch (error: any) {
    const isExpired = error?.name === "TokenExpiredError";
    const code = isExpired ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID";
    const spec = ERROR_CATALOG[code];
    logWarn("auth_token_invalid", {
      reason: isExpired ? "expired" : "invalid",
      path: req.path,
      requestId: req.requestId,
    });
    return res
      .status(spec.httpStatus)
      .json({ message: spec.defaultMessage, code, requestId: req.requestId });
  }
}

// Note: do not re-export AuthenticatedRequest to avoid conflicts with TS's declaration merging

/**
 * verifySupabaseTokenOnly
 * Verifies the Supabase JWT and attaches req.user without checking DB.
 * Use this for endpoints that are responsible for creating/syncing the user row
 * (e.g., /api/auth/sync). All other endpoints should use authenticateSupabaseUser.
 */
export async function verifySupabaseTokenOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!token) {
      const spec = ERROR_CATALOG.AUTH_MISSING_TOKEN;
      logWarn("auth_missing_token", {
        path: req.path,
        method: req.method,
        requestId: req.requestId,
      });
      return res.status(spec.httpStatus).json({
        message: spec.defaultMessage,
        code: "AUTH_MISSING_TOKEN",
        requestId: req.requestId,
      });
    }

    const jwtSecret = getSupabaseJwtSecret();
    if (!jwtSecret) {
      const spec = ERROR_CATALOG.SERVER_MISCONFIGURED;
      return res.status(spec.httpStatus).json({
        message: spec.defaultMessage,
        code: "SERVER_MISCONFIGURED",
        requestId: req.requestId,
      });
    }

    const { userId, email } = verifySupabaseToken(token, jwtSecret);
    if (!userId) {
      const spec = ERROR_CATALOG.AUTH_NO_SUB;
      logWarn("auth_no_sub", { path: req.path, requestId: req.requestId });
      return res
        .status(spec.httpStatus)
        .json({ message: spec.defaultMessage, code: "AUTH_NO_SUB", requestId: req.requestId });
    }

    req.user = { userId, email };
    next();
  } catch (error: any) {
    const isExpired = error?.name === "TokenExpiredError";
    const code = isExpired ? "AUTH_TOKEN_EXPIRED" : "AUTH_TOKEN_INVALID";
    const spec = ERROR_CATALOG[code];
    logWarn("auth_token_invalid", {
      reason: isExpired ? "expired" : "invalid",
      path: req.path,
      requestId: req.requestId,
    });
    return res
      .status(spec.httpStatus)
      .json({ message: spec.defaultMessage, code, requestId: req.requestId });
  }
}

/**
 * verifySupabaseToken
 * Pure function that verifies a JWT using the provided secret and extracts user id/email.
 * Throws TokenExpiredError on expiry or JsonWebTokenError on invalid token.
 */
export function verifySupabaseToken(
  token: string,
  secret: string,
): { userId: string; email?: string } {
  const decoded = jwt.verify(token, secret) as {
    sub: string;
    email?: string;
    [k: string]: unknown;
  };
  const userId = decoded.sub;
  const email = decoded.email;
  if (!userId) {
    const error = new Error("Missing sub claim");
    (error as any).name = "JsonWebTokenError"; // annotate for upstream handling
    throw error;
  }
  return { userId, email };
}
