// Enhanced structured logger for comprehensive monitoring and observability
// Supports performance metrics, error tracking, and enhanced structured logging

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface BaseLog {
  level: LogLevel;
  ts: string; // ISO timestamp
  msg: string;
  requestId?: string;
  jobId?: string;
  userId?: string;
  path?: string;
  method?: string;
  component?: string; // Component/module name
  duration?: number; // Performance metrics in milliseconds
  error?: {
    type: string;
    message: string;
    stack?: string;
    code?: string;
    statusCode?: number;
  };
  metrics?: {
    memory?: number; // Memory usage in MB
    cpu?: number; // CPU usage percentage
    responseTime?: number; // Response time in milliseconds
    rowCount?: number; // For job processing
    fileSize?: number; // For file operations
  };
  // Any extra structured fields are allowed
  [key: string]: unknown;
}

// Performance tracking utilities
const performanceMarks = new Map<string, number>();

export function startPerformanceMark(markName: string): void {
  performanceMarks.set(markName, performance.now());
}

export function endPerformanceMark(markName: string): number | null {
  const startTime = performanceMarks.get(markName);
  if (startTime) {
    const duration = performance.now() - startTime;
    performanceMarks.delete(markName);
    return duration;
  }
  return null;
}

// Error tracking utilities
export interface ErrorDetails {
  type: string;
  message: string;
  stack?: string;
  code?: string;
  statusCode?: number;
  context?: Record<string, unknown>;
}

export function createErrorDetails(error: unknown, context?: Record<string, unknown>): ErrorDetails {
  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      statusCode: (error as any).statusCode,
      context,
    };
  }
  
  return {
    type: typeof error === 'string' ? 'StringError' : 'UnknownError',
    message: String(error),
    context,
  };
}

// Enhanced logging functions with performance tracking and error handling
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{"_error":"cannot_stringify"}';
  }
}

function createLogPayload(
  level: LogLevel, 
  message: string, 
  fields: Omit<BaseLog, "level" | "ts" | "msg"> = {}
): BaseLog {
  const payload: BaseLog = { 
    level, 
    ts: new Date().toISOString(), 
    msg: message, 
    ...fields 
  };
  
  // Add performance metrics if available
  if (fields.requestId && performanceMarks.has(`request-${fields.requestId}`)) {
    const duration = endPerformanceMark(`request-${fields.requestId}`);
    if (duration !== null) {
      payload.duration = duration;
      if (payload.metrics) {
        payload.metrics.responseTime = duration;
      } else {
        payload.metrics = { responseTime: duration };
      }
    }
  }
  
  return payload;
}

export function logDebug(message: string, fields: Omit<BaseLog, "level" | "ts" | "msg"> = {}) {
  const payload = createLogPayload("DEBUG", message, fields);
  // eslint-disable-next-line no-console
  console.debug(safeStringify(payload));
}

export function logInfo(message: string, fields: Omit<BaseLog, "level" | "ts" | "msg"> = {}) {
  const payload = createLogPayload("INFO", message, fields);
  // eslint-disable-next-line no-console
  console.log(safeStringify(payload));
}

export function logWarn(message: string, fields: Omit<BaseLog, "level" | "ts" | "msg"> = {}) {
  const payload = createLogPayload("WARN", message, fields);
  // eslint-disable-next-line no-console
  console.warn(safeStringify(payload));
}

export function logError(message: string, fields: Omit<BaseLog, "level" | "ts" | "msg"> = {}) {
  const payload = createLogPayload("ERROR", message, fields);
  // eslint-disable-next-line no-console
  console.error(safeStringify(payload));
}

// Performance-aware logging
export function logWithPerformance(
  level: LogLevel,
  message: string,
  markName: string,
  fields: Omit<BaseLog, "level" | "ts" | "msg" | "duration"> = {}
) {
  const duration = endPerformanceMark(markName);
  const enhancedFields = {
    ...fields,
    duration,
    metrics: {
      ...(fields.metrics || {}),
      responseTime: duration,
    },
  };
  
  switch (level) {
    case "DEBUG":
      logDebug(message, enhancedFields);
      break;
    case "INFO":
      logInfo(message, enhancedFields);
      break;
    case "WARN":
      logWarn(message, enhancedFields);
      break;
    case "ERROR":
      logError(message, enhancedFields);
      break;
  }
}

// Request tracking utilities
export function startRequestTracking(requestId: string): void {
  startPerformanceMark(`request-${requestId}`);
}

export function endRequestTracking(requestId: string): number | null {
  return endPerformanceMark(`request-${requestId}`);
}

// Job tracking utilities
export function startJobTracking(jobId: string): void {
  startPerformanceMark(`job-${jobId}`);
}

export function endJobTracking(jobId: string): number | null {
  return endPerformanceMark(`job-${jobId}`);
}

// Memory usage tracking
export function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100; // MB
  }
  return 0;
}

// Enhanced logging with memory tracking
export function logWithMemory(
  level: LogLevel,
  message: string,
  fields: Omit<BaseLog, "level" | "ts" | "msg" | "metrics"> = {}
) {
  const memoryUsage = getMemoryUsage();
  const enhancedFields = {
    ...fields,
    metrics: {
      ...(fields.metrics || {}),
      memory: memoryUsage,
    },
  };
  
  switch (level) {
    case "DEBUG":
      logDebug(message, enhancedFields);
      break;
    case "INFO":
      logInfo(message, enhancedFields);
      break;
    case "WARN":
      logWarn(message, enhancedFields);
      break;
    case "ERROR":
      logError(message, enhancedFields);
      break;
  }
}
