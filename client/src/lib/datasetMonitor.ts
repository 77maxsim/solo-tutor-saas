import { supabase } from "@/lib/supabaseClient";

// Performance monitoring and alerting for large datasets
export class DatasetMonitor {
  private static instance: DatasetMonitor;
  private performanceMetrics: Map<string, {
    queryTime: number;
    sessionCount: number;
    timestamp: number;
  }> = new Map();

  static getInstance(): DatasetMonitor {
    if (!DatasetMonitor.instance) {
      DatasetMonitor.instance = new DatasetMonitor();
    }
    return DatasetMonitor.instance;
  }

  // Monitor query performance and log metrics
  async trackQueryPerformance(tutorId: string, queryType: 'standard' | 'optimized', startTime: number, sessionCount: number) {
    const queryTime = Date.now() - startTime;
    
    this.performanceMetrics.set(tutorId, {
      queryTime,
      sessionCount,
      timestamp: Date.now()
    });

    // Log performance metrics
    console.log(`📊 Query Performance [${queryType}]:`, {
      tutorId: tutorId.substring(0, 8) + '...',
      queryTime: `${queryTime}ms`,
      sessionCount,
      performanceRating: this.getPerformanceRating(queryTime, sessionCount)
    });

    // Alert if performance is degraded
    if (queryTime > 5000) { // 5 seconds
      console.warn(`⚠️ Slow query detected: ${queryTime}ms for ${sessionCount} sessions`);
    }

    // Suggest further optimization if needed
    if (sessionCount > 5000 && queryType === 'optimized') {
      console.warn(`⚠️ Consider pagination or additional optimization for ${sessionCount} sessions`);
    }
  }

  private getPerformanceRating(queryTime: number, sessionCount: number): string {
    const timePerSession = sessionCount > 0 ? queryTime / sessionCount : 0;
    
    if (timePerSession < 1) return 'Excellent';
    if (timePerSession < 3) return 'Good';
    if (timePerSession < 5) return 'Fair';
    return 'Needs Optimization';
  }

  // Check if tutor might benefit from data archiving
  async checkArchivingRecommendation(tutorId: string): Promise<boolean> {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutorId)
        .lt('date', oneYearAgo.toISOString().split('T')[0]);

      if (error) {
        console.error('Error checking archiving eligibility:', error);
        return false;
      }

      const shouldArchive = (count || 0) > 1000;
      
      if (shouldArchive) {
        console.log(`📦 Archiving recommendation: ${count} sessions older than 1 year detected`);
      }

      return shouldArchive;
    } catch (error) {
      console.error('Error in archiving check:', error);
      return false;
    }
  }

  // Get performance summary for debugging
  getPerformanceSummary(): any {
    const summary: any = {};
    
    this.performanceMetrics.forEach((metrics, tutorId) => {
      summary[tutorId.substring(0, 8) + '...'] = {
        lastQueryTime: `${metrics.queryTime}ms`,
        sessionCount: metrics.sessionCount,
        performanceRating: this.getPerformanceRating(metrics.queryTime, metrics.sessionCount),
        lastChecked: new Date(metrics.timestamp).toISOString()
      };
    });

    return summary;
  }
}

// Export singleton instance
export const datasetMonitor = DatasetMonitor.getInstance();