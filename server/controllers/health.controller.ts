// Comprehensive health check controller for system monitoring and observability
// Monitors database, storage, LLM providers, worker processes, and real-time connections

import { Request, Response } from 'express';
import { logInfo, logError, startPerformanceMark, endPerformanceMark } from '../../shared/logger';
import { healthService, type ComponentHealth } from '../services/health.service';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  requestId: string;
  duration: number;
  components: {
    database: ComponentHealth;
    storage: ComponentHealth;
    llmProviders: ComponentHealth;
    workerProcesses: ComponentHealth;
    realtimeConnection: ComponentHealth;
  };
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    criticalIssues: string[];
    warnings: string[];
    recommendations: string[];
  };
}

interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, unknown>;
  lastChecked: string;
  error?: string;
}

interface LLMProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastChecked: string;
  error?: string;
  rateLimitInfo?: {
    remaining: number;
    reset: string;
  };
}

export class HealthController {

  /**
   * Comprehensive health check endpoint
   * Monitors all critical system components
   */
  public async getHealthCheck(req: Request, res: Response): Promise<void> {
    const startTime = performance.now();
    const requestId = req.requestId || 'unknown';
    
    logInfo('Starting comprehensive health check', {
      requestId,
      component: 'HealthController',
      method: 'getHealthCheck',
    });

    try {
      // Start performance tracking
      startPerformanceMark(`health-check-${requestId}`);

      // Run all health checks concurrently
      const [
        databaseHealth,
        storageHealth,
        llmProvidersHealth,
        workerProcessesHealth,
        realtimeConnectionHealth
      ] = await Promise.allSettled([
        healthService.checkDatabase(),
        healthService.checkStorage(),
        healthService.checkLLMProviders(),
        healthService.checkWorkerProcesses(),
        healthService.checkRealtime(),
      ]);

      // Process results
      const components = {
        database: this.processHealthResult(databaseHealth, 'Database'),
        storage: this.processHealthResult(storageHealth, 'Storage'),
        llmProviders: this.processHealthResult(llmProvidersHealth, 'LLM Providers'),
        workerProcesses: this.processHealthResult(workerProcessesHealth, 'Worker Processes'),
        realtimeConnection: this.processHealthResult(realtimeConnectionHealth, 'Real-time Connection'),
      };

      // Determine overall health status
      const overall = healthService.determineOverall(components);

      // End performance tracking
      const duration = endPerformanceMark(`health-check-${requestId}`) || 0;

      const healthResult: HealthCheckResult = {
        status: overall.status,
        timestamp: new Date().toISOString(),
        requestId,
        duration,
        components,
        overall,
      };

      // Log health check completion
      logInfo('Health check completed', {
        requestId,
        component: 'HealthController',
        method: 'getHealthCheck',
        duration,
        overallStatus: overall.status,
        criticalIssues: overall.criticalIssues.length,
        warnings: overall.warnings.length,
      });

      // Set appropriate HTTP status code
      const statusCode = overall.status === 'healthy' ? 200 : 
                        overall.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(healthResult);

    } catch (error) {
      const duration = endPerformanceMark(`health-check-${requestId}`) || 0;
      
      logError('Health check failed', {
        requestId,
        component: 'HealthController',
        method: 'getHealthCheck',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        requestId,
        duration,
        error: 'Health check system failure',
        components: {},
        overall: {
          status: 'unhealthy',
          criticalIssues: ['Health check system failure'],
          warnings: [],
          recommendations: ['Check system logs for details'],
        },
      });
    }
  }

  private processHealthResult(
    result: PromiseSettledResult<ComponentHealth>, 
    componentName: string
  ): ComponentHealth {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    
    return {
      status: 'unhealthy',
      responseTime: 0,
      details: {
        error: `Health check failed: ${result.reason}`,
      },
      lastChecked: new Date().toISOString(),
      error: `Health check failed: ${result.reason}`,
    };
  }

}

export const healthController = new HealthController();
