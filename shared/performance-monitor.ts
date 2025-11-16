// Comprehensive performance monitoring system for observability
// Tracks metrics, response times, and resource usage across the application

import { logInfo, logWarn, logError, logWithMemory } from './logger';

// Performance metric types
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
  metadata?: Record<string, unknown>;
}

// Performance threshold configuration
export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
}

// Performance alert
export interface PerformanceAlert {
  metric: string;
  threshold: PerformanceThreshold;
  currentValue: number;
  timestamp: string;
  severity: 'warning' | 'critical';
}

// Performance statistics
export interface PerformanceStats {
  totalMetrics: number;
  metricsByName: Record<string, PerformanceMetric[]>;
  averages: Record<string, number>;
  minValues: Record<string, number>;
  maxValues: Record<string, number>;
  lastUpdated: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private alerts: PerformanceAlert[] = [];
  private maxMetrics: number = 10000; // Prevent memory leaks
  private startTime: number = Date.now();

  constructor() {
    this.initializeDefaultThresholds();
  }

  /**
   * Record a performance metric
   */
  public recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags: Record<string, string> = {},
    metadata?: Record<string, unknown>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags,
      metadata,
    };

    this.metrics.push(metric);

    // Maintain max metrics limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Check thresholds
    this.checkThresholds(metric);

    // Log high-value metrics
    this.logHighValueMetrics(metric);
  }

  /**
   * Record response time for an operation
   */
  public recordResponseTime(
    operation: string,
    duration: number,
    tags: Record<string, string> = {},
    metadata?: Record<string, unknown>
  ): void {
    this.recordMetric(
      `${operation}_response_time`,
      duration,
      'ms',
      { operation, ...tags },
      metadata
    );
  }

  /**
   * Record memory usage
   */
  public recordMemoryUsage(
    context: string,
    tags: Record<string, string> = {}
  ): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      
      this.recordMetric(
        `${context}_memory_heap_used`,
        Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        'MB',
        { context, type: 'heap_used', ...tags }
      );

      this.recordMetric(
        `${context}_memory_heap_total`,
        Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        'MB',
        { context, type: 'heap_total', ...tags }
      );

      this.recordMetric(
        `${context}_memory_external`,
        Math.round(memUsage.external / 1024 / 100) / 100,
        'KB',
        { context, type: 'external', ...tags }
      );
    }
  }

  /**
   * Record database operation performance
   */
  public recordDatabaseOperation(
    operation: string,
    duration: number,
    table?: string,
    rowsAffected?: number,
    tags: Record<string, string> = {}
  ): void {
    this.recordMetric(
      `database_${operation}_duration`,
      duration,
      'ms',
      { 
        operation, 
        table: table || 'unknown',
        rowsAffected: rowsAffected?.toString() || 'unknown',
        ...tags 
      }
    );

    if (rowsAffected !== undefined) {
      this.recordMetric(
        `database_${operation}_rows`,
        rowsAffected,
        'count',
        { 
          operation, 
          table: table || 'unknown',
          ...tags 
        }
      );
    }
  }

  /**
   * Record file operation performance
   */
  public recordFileOperation(
    operation: string,
    duration: number,
    fileSize?: number,
    fileName?: string,
    tags: Record<string, string> = {}
  ): void {
    this.recordMetric(
      `file_${operation}_duration`,
      duration,
      'ms',
      { 
        operation, 
        fileName: fileName || 'unknown',
        ...tags 
      }
    );

    if (fileSize !== undefined) {
      this.recordMetric(
        `file_${operation}_size`,
        fileSize,
        'bytes',
        { 
          operation, 
          fileName: fileName || 'unknown',
          ...tags 
        }
      );
    }
  }

  /**
   * Record LLM API call performance
   */
  public recordLLMCall(
    provider: string,
    model: string,
    duration: number,
    tokensUsed?: number,
    success: boolean = true,
    tags: Record<string, string> = {}
  ): void {
    this.recordMetric(
      `llm_${provider}_${model}_response_time`,
      duration,
      'ms',
      { 
        provider, 
        model, 
        success: success.toString(),
        ...tags 
      }
    );

    if (tokensUsed !== undefined) {
      this.recordMetric(
        `llm_${provider}_${model}_tokens`,
        tokensUsed,
        'count',
        { 
        provider, 
        model, 
        success: success.toString(),
        ...tags 
      }
      );
    }
  }

  /**
   * Record job processing performance
   */
  public recordJobProcessing(
    jobId: string,
    duration: number,
    rowsProcessed: number,
    success: boolean = true,
    tags: Record<string, string> = {}
  ): void {
    this.recordMetric(
      `job_processing_duration`,
      duration,
      'ms',
      { 
        jobId, 
        success: success.toString(),
        ...tags 
      }
    );

    this.recordMetric(
      `job_processing_rows`,
      rowsProcessed,
      'count',
      { 
        jobId, 
        success: success.toString(),
        ...tags 
      }
    );

    // Calculate and record processing rate
    if (duration > 0) {
      const rowsPerSecond = (rowsProcessed / duration) * 1000;
      this.recordMetric(
        `job_processing_rate`,
        Math.round(rowsPerSecond * 100) / 100,
        'rows_per_second',
        { 
          jobId, 
          success: success.toString(),
          ...tags 
        }
      );
    }
  }

  /**
   * Get metrics with optional filtering
   */
  public getMetrics(filters?: {
    name?: string;
    tags?: Record<string, string>;
    timeRange?: { start: string; end: string };
    limit?: number;
  }): PerformanceMetric[] {
    let filteredMetrics = [...this.metrics];

    if (filters?.name) {
      filteredMetrics = filteredMetrics.filter(m => m.name.includes(filters.name!));
    }

    if (filters?.tags) {
      filteredMetrics = filteredMetrics.filter(m => 
        Object.entries(filters.tags!).every(([key, value]) => 
          m.tags[key] === value
        )
      );
    }

    if (filters?.timeRange) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.timestamp >= filters.timeRange!.start && m.timestamp <= filters.timeRange!.end
      );
    }

    // Sort by timestamp (newest first)
    filteredMetrics.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      filteredMetrics = filteredMetrics.slice(0, filters.limit);
    }

    return filteredMetrics;
  }

  /**
   * Get performance statistics
   */
  public getStats(): PerformanceStats {
    const stats: PerformanceStats = {
      totalMetrics: this.metrics.length,
      metricsByName: {},
      averages: {},
      minValues: {},
      maxValues: {},
      lastUpdated: new Date().toISOString(),
    };

    // Group metrics by name
    for (const metric of this.metrics) {
      if (!stats.metricsByName[metric.name]) {
        stats.metricsByName[metric.name] = [];
      }
      stats.metricsByName[metric.name].push(metric);
    }

    // Calculate statistics for each metric type
    for (const [name, metrics] of Object.entries(stats.metricsByName)) {
      const values = metrics.map(m => m.value);
      
      stats.averages[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
      stats.minValues[name] = Math.min(...values);
      stats.maxValues[name] = Math.max(...values);
    }

    return stats;
  }

  /**
   * Add performance threshold
   */
  public addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold);
  }

  /**
   * Remove performance threshold
   */
  public removeThreshold(metric: string): boolean {
    const index = this.thresholds.findIndex(t => t.metric === metric);
    if (index !== -1) {
      this.thresholds.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get current alerts
   */
  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear resolved alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get system uptime
   */
  public getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get system performance summary
   */
  public getSystemSummary(): Record<string, unknown> {
    const stats = this.getStats();
    const uptime = this.getUptime();
    
    // Get recent metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentMetrics = this.getMetrics({
      timeRange: { start: oneHourAgo, end: new Date().toISOString() }
    });

    // Calculate recent averages
    const recentAverages: Record<string, number> = {};
    const recentMetricsByName: Record<string, PerformanceMetric[]> = {};
    
    for (const metric of recentMetrics) {
      if (!recentMetricsByName[metric.name]) {
        recentMetricsByName[metric.name] = [];
      }
      recentMetricsByName[metric.name].push(metric);
    }

    for (const [name, metrics] of Object.entries(recentMetricsByName)) {
      const values = metrics.map(m => m.value);
      recentAverages[name] = values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    return {
      uptime,
      totalMetrics: stats.totalMetrics,
      recentMetrics: recentMetrics.length,
      recentAverages,
      currentAlerts: this.alerts.length,
      thresholds: this.thresholds.length,
    };
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    for (const threshold of this.thresholds) {
      if (threshold.enabled && threshold.metric === metric.name) {
        if (metric.value >= threshold.critical) {
          this.createAlert(metric, threshold, 'critical');
        } else if (metric.value >= threshold.warning) {
          this.createAlert(metric, threshold, 'warning');
        }
      }
    }
  }

  /**
   * Create performance alert
   */
  private createAlert(
    metric: PerformanceMetric,
    threshold: PerformanceThreshold,
    severity: 'warning' | 'critical'
  ): void {
    const alert: PerformanceAlert = {
      metric: metric.name,
      threshold,
      currentValue: metric.value,
      timestamp: new Date().toISOString(),
      severity,
    };

    this.alerts.push(alert);

    // Log the alert
    const alertMessage = `PERFORMANCE ALERT: ${metric.name} = ${metric.value}${metric.unit} (${severity.toUpperCase()})`;
    
    if (severity === 'critical') {
      logError(alertMessage, {
        component: 'PerformanceMonitor',
        method: 'createAlert',
        alertType: 'performance_threshold_exceeded',
        metric: metric.name,
        severity,
        threshold: threshold[severity],
        currentValue: metric.value,
        tags: metric.tags,
      });
    } else {
      logWarn(alertMessage, {
        component: 'PerformanceMonitor',
        method: 'createAlert',
        alertType: 'performance_threshold_exceeded',
        metric: metric.name,
        severity,
        threshold: threshold[severity],
        currentValue: metric.value,
        tags: metric.tags,
      });
    }
  }

  /**
   * Log high-value metrics for monitoring
   */
  private logHighValueMetrics(metric: PerformanceMetric): void {
    // Log metrics that might indicate performance issues
    if (metric.name.includes('response_time') && metric.value > 5000) {
      logWarn('High response time detected', {
        component: 'PerformanceMonitor',
        method: 'logHighValueMetrics',
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        tags: metric.tags,
        threshold: 5000,
      });
    }

    if (metric.name.includes('memory') && metric.value > 100) {
      logWarn('High memory usage detected', {
        component: 'PerformanceMonitor',
        method: 'logHighValueMetrics',
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        tags: metric.tags,
        threshold: 100,
      });
    }
  }

  /**
   * Initialize default performance thresholds
   */
  private initializeDefaultThresholds(): void {
    this.thresholds = [
      {
        metric: 'response_time',
        warning: 2000, // 2 seconds
        critical: 5000, // 5 seconds
        enabled: true,
      },
      {
        metric: 'memory_heap_used',
        warning: 100, // 100 MB
        critical: 200, // 200 MB
        enabled: true,
      },
      {
        metric: 'database_query_duration',
        warning: 1000, // 1 second
        critical: 3000, // 3 seconds
        enabled: true,
      },
      {
        metric: 'file_upload_duration',
        warning: 5000, // 5 seconds
        critical: 15000, // 15 seconds
        enabled: true,
      },
      {
        metric: 'llm_response_time',
        warning: 10000, // 10 seconds
        critical: 30000, // 30 seconds
        enabled: true,
      },
    ];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Export convenience functions
export const recordMetric = performanceMonitor.recordMetric.bind(performanceMonitor);
export const recordResponseTime = performanceMonitor.recordResponseTime.bind(performanceMonitor);
export const recordMemoryUsage = performanceMonitor.recordMemoryUsage.bind(performanceMonitor);
export const recordDatabaseOperation = performanceMonitor.recordDatabaseOperation.bind(performanceMonitor);
export const recordFileOperation = performanceMonitor.recordFileOperation.bind(performanceMonitor);
export const recordLLMCall = performanceMonitor.recordLLMCall.bind(performanceMonitor);
export const recordJobProcessing = performanceMonitor.recordJobProcessing.bind(performanceMonitor);
export const getPerformanceStats = performanceMonitor.getStats.bind(performanceMonitor);
export const getSystemSummary = performanceMonitor.getSystemSummary.bind(performanceMonitor);
