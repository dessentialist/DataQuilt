// Comprehensive error tracking system for monitoring and observability
// Captures, categorizes, and reports errors with proper taxonomy and request correlation

import { logError, logWarn, logInfo } from './logger';

// Error taxonomy for consistent categorization
export enum ErrorCategory {
  // Authentication and Authorization
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SESSION_EXPIRED = 'session_expired',
  INVALID_TOKEN = 'invalid_token',
  
  // API and External Services
  API_ERROR = 'api_error',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
  EXTERNAL_SERVICE_UNAVAILABLE = 'external_service_unavailable',
  
  // Database and Storage
  DATABASE_ERROR = 'database_error',
  CONNECTION_ERROR = 'connection_error',
  QUERY_ERROR = 'query_error',
  STORAGE_ERROR = 'storage_error',
  FILE_NOT_FOUND = 'file_not_found',
  
  // Data Processing
  VALIDATION_ERROR = 'validation_error',
  PARSE_ERROR = 'parse_error',
  TRANSFORMATION_ERROR = 'transformation_error',
  ENCRYPTION_ERROR = 'encryption_error',
  
  // System and Infrastructure
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_ERROR = 'configuration_error',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  UNKNOWN_ERROR = 'unknown_error',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error context information
export interface ErrorContext {
  requestId?: string;
  userId?: string;
  jobId?: string;
  component?: string;
  method?: string;
  path?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: string;
  environment: string;
  version?: string;
}

// Error details for comprehensive tracking
export interface TrackedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: unknown;
  stack?: string;
  context: ErrorContext;
  metadata: Record<string, unknown>;
  timestamp: string;
  resolved: boolean;
  resolutionTime?: string;
  retryCount: number;
  maxRetries: number;
}

// Error alert configuration
export interface ErrorAlert {
  category: ErrorCategory;
  severity: ErrorSeverity;
  threshold: number;
  timeWindow: number; // milliseconds
  enabled: boolean;
}

// Error tracking statistics
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByComponent: Record<string, number>;
  averageResolutionTime: number;
  unresolvedErrors: number;
  lastErrorTime: string;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  private alerts: ErrorAlert[] = [];
  private stats: ErrorStats;
  private maxErrors: number = 1000; // Prevent memory leaks

  constructor() {
    this.stats = this.initializeStats();
    this.initializeDefaultAlerts();
  }

  /**
   * Track an error with comprehensive context
   */
  public trackError(
    error: unknown,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
    metadata: Record<string, unknown> = {}
  ): string {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    // Create error context
    const errorContext: ErrorContext = {
      timestamp,
      environment: process.env.NODE_ENV || 'development',
      ...context,
    };

    // Extract error details
    const errorDetails = this.extractErrorDetails(error);
    
    // Create tracked error
    const trackedError: TrackedError = {
      id: errorId,
      category,
      severity,
      message: errorDetails.message,
      originalError: error,
      stack: errorDetails.stack,
      context: errorContext,
      metadata,
      timestamp,
      resolved: false,
      retryCount: 0,
      maxRetries: this.getMaxRetriesForCategory(category),
    };

    // Add to errors list
    this.errors.push(trackedError);
    
    // Maintain max errors limit
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Update statistics
    this.updateStats(trackedError);

    // Check for alerts
    this.checkAlerts(trackedError);

    // Log the error
    this.logError(trackedError);

    return errorId;
  }

  /**
   * Mark an error as resolved
   */
  public resolveError(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      error.resolutionTime = new Date().toISOString();
      this.updateStats(error);
      return true;
    }
    return false;
  }

  /**
   * Increment retry count for an error
   */
  public incrementRetryCount(errorId: string): boolean {
    const error = this.errors.find(e => e.id === errorId);
    if (error && error.retryCount < error.maxRetries) {
      error.retryCount++;
      this.updateStats(error);
      return true;
    }
    return false;
  }

  /**
   * Get error by ID
   */
  public getError(errorId: string): TrackedError | undefined {
    return this.errors.find(e => e.id === errorId);
  }

  /**
   * Get all errors with optional filtering
   */
  public getErrors(filters?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    resolved?: boolean;
    component?: string;
    timeRange?: { start: string; end: string };
  }): TrackedError[] {
    let filteredErrors = [...this.errors];

    if (filters?.category) {
      filteredErrors = filteredErrors.filter(e => e.category === filters.category);
    }

    if (filters?.severity) {
      filteredErrors = filteredErrors.filter(e => e.severity === filters.severity);
    }

    if (filters?.resolved !== undefined) {
      filteredErrors = filteredErrors.filter(e => e.resolved === filters.resolved);
    }

    if (filters?.component) {
      filteredErrors = filteredErrors.filter(e => e.context.component === filters.component);
    }

    if (filters?.timeRange) {
      filteredErrors = filteredErrors.filter(e => 
        e.timestamp >= filters.timeRange!.start && e.timestamp <= filters.timeRange!.end
      );
    }

    return filteredErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get error statistics
   */
  public getStats(): ErrorStats {
    return { ...this.stats };
  }

  /**
   * Add custom alert configuration
   */
  public addAlert(alert: ErrorAlert): void {
    this.alerts.push(alert);
  }

  /**
   * Remove alert configuration
   */
  public removeAlert(category: ErrorCategory, severity: ErrorSeverity): boolean {
    const index = this.alerts.findIndex(a => a.category === category && a.severity === severity);
    if (index !== -1) {
      this.alerts.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear resolved errors older than specified time
   */
  public cleanupResolvedErrors(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const initialCount = this.errors.length;
    
    this.errors = this.errors.filter(error => 
      !error.resolved || new Date(error.timestamp) > cutoffTime
    );
    
    const removedCount = initialCount - this.errors.length;
    if (removedCount > 0) {
      this.recalculateStats();
    }
    
    return removedCount;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract error details from various error types
   */
  private extractErrorDetails(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
      };
    }
    
    if (typeof error === 'string') {
      return { message: error };
    }
    
    if (error && typeof error === 'object' && 'message' in error) {
      return {
        message: String((error as any).message),
        stack: (error as any).stack,
      };
    }
    
    return { message: String(error) };
  }

  /**
   * Get maximum retries for error category
   */
  private getMaxRetriesForCategory(category: ErrorCategory): number {
    switch (category) {
      case ErrorCategory.RATE_LIMIT:
      case ErrorCategory.TIMEOUT:
      case ErrorCategory.NETWORK_ERROR:
        return 3;
      case ErrorCategory.API_ERROR:
      case ErrorCategory.EXTERNAL_SERVICE_UNAVAILABLE:
        return 2;
      default:
        return 0;
    }
  }

  /**
   * Update error statistics
   */
  private updateStats(error: TrackedError): void {
    this.stats.totalErrors++;
    this.stats.errorsByCategory[error.category]++;
    this.stats.errorsBySeverity[error.severity]++;
    
    if (error.context.component) {
      this.stats.errorsByComponent[error.context.component] = 
        (this.stats.errorsByComponent[error.context.component] || 0) + 1;
    }
    
    this.stats.lastErrorTime = error.timestamp;
    
    if (error.resolved) {
      this.stats.unresolvedErrors = Math.max(0, this.stats.unresolvedErrors - 1);
    } else {
      this.stats.unresolvedErrors++;
    }
  }

  /**
   * Check for alerts based on error patterns
   */
  private checkAlerts(error: TrackedError): void {
    for (const alert of this.alerts) {
      if (alert.enabled && 
          alert.category === error.category && 
          alert.severity === error.severity) {
        
        // Check if threshold is exceeded in time window
        const timeWindowStart = Date.now() - alert.timeWindow;
        const recentErrors = this.errors.filter(e => 
          e.category === alert.category &&
          e.severity === alert.severity &&
          new Date(e.timestamp).getTime() > timeWindowStart
        );
        
        if (recentErrors.length >= alert.threshold) {
          this.triggerAlert(alert, recentErrors);
        }
      }
    }
  }

  /**
   * Trigger an error alert
   */
  private triggerAlert(alert: ErrorAlert, errors: TrackedError[]): void {
    const alertMessage = `ALERT: ${errors.length} ${alert.severity} ${alert.category} errors in ${alert.timeWindow / 1000}s`;
    
    logWarn(alertMessage, {
      component: 'ErrorTracker',
      method: 'triggerAlert',
      alertType: 'error_threshold_exceeded',
      category: alert.category,
      severity: alert.severity,
      threshold: alert.threshold,
      timeWindow: alert.timeWindow,
      errorCount: errors.length,
      recentErrors: errors.slice(-5).map(e => ({
        id: e.id,
        message: e.message,
        timestamp: e.timestamp,
        context: e.context,
      })),
    });
  }

  /**
   * Log error with appropriate level
   */
  private logError(error: TrackedError): void {
    const logFields = {
      component: 'ErrorTracker',
      method: 'trackError',
      errorId: error.id,
      category: error.category,
      severity: error.severity,
      context: error.context,
      metadata: error.metadata,
      retryCount: error.retryCount,
      maxRetries: error.maxRetries,
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        logError(`[${error.category.toUpperCase()}] ${error.message}`, logFields);
        break;
      case ErrorSeverity.MEDIUM:
        logWarn(`[${error.category.toUpperCase()}] ${error.message}`, logFields);
        break;
      case ErrorSeverity.LOW:
        logInfo(`[${error.category.toUpperCase()}] ${error.message}`, logFields);
        break;
    }
  }

  /**
   * Initialize error statistics
   */
  private initializeStats(): ErrorStats {
    return {
      totalErrors: 0,
      errorsByCategory: Object.values(ErrorCategory).reduce((acc, category) => {
        acc[category] = 0;
        return acc;
      }, {} as Record<ErrorCategory, number>),
      errorsBySeverity: Object.values(ErrorSeverity).reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<ErrorSeverity, number>),
      errorsByComponent: {},
      averageResolutionTime: 0,
      unresolvedErrors: 0,
      lastErrorTime: '',
    };
  }

  /**
   * Initialize default alert configurations
   */
  private initializeDefaultAlerts(): void {
    this.alerts = [
      {
        category: ErrorCategory.SYSTEM_ERROR,
        severity: ErrorSeverity.CRITICAL,
        threshold: 1,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        enabled: true,
      },
      {
        category: ErrorCategory.API_ERROR,
        severity: ErrorSeverity.HIGH,
        threshold: 5,
        timeWindow: 10 * 60 * 1000, // 10 minutes
        enabled: true,
      },
      {
        category: ErrorCategory.DATABASE_ERROR,
        severity: ErrorSeverity.HIGH,
        threshold: 3,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        enabled: true,
      },
      {
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        threshold: 10,
        timeWindow: 15 * 60 * 1000, // 15 minutes
        enabled: true,
      },
    ];
  }

  /**
   * Recalculate statistics after cleanup
   */
  private recalculateStats(): void {
    this.stats = this.initializeStats();
    
    for (const error of this.errors) {
      this.updateStats(error);
    }
  }
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

// Export convenience functions
export const trackError = errorTracker.trackError.bind(errorTracker);
export const resolveError = errorTracker.resolveError.bind(errorTracker);
export const getErrors = errorTracker.getErrors.bind(errorTracker);
export const getErrorStats = errorTracker.getStats.bind(errorTracker);
