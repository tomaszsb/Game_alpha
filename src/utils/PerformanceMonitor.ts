// src/utils/PerformanceMonitor.ts

export interface PerformanceMeasurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export class PerformanceMonitor {
  private static measurements: Map<string, PerformanceMeasurement> = new Map();
  private static enabled = true;

  static startMeasurement(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const measurement: PerformanceMeasurement = {
      name,
      startTime: performance.now(),
      metadata
    };

    this.measurements.set(name, measurement);
    console.log(`⏱️ PERF: Starting ${name}`, metadata || '');
  }

  static endMeasurement(name: string): number | null {
    if (!this.enabled) return null;

    const measurement = this.measurements.get(name);
    if (!measurement) {
      console.warn(`⚠️ PERF: No measurement started for "${name}"`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - measurement.startTime;

    measurement.endTime = endTime;
    measurement.duration = duration;

    console.log(`✅ PERF: ${name} completed in ${duration.toFixed(2)}ms`);
    return duration;
  }

  static getMeasurement(name: string): PerformanceMeasurement | undefined {
    return this.measurements.get(name);
  }

  static getAllMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values());
  }

  static getCompletedMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values()).filter(m => m.duration !== undefined);
  }

  static getTotalLoadTime(): number {
    const appInitMeasurement = this.getMeasurement('app-initialization');
    return appInitMeasurement?.duration || 0;
  }

  static generateReport(): string {
    const completed = this.getCompletedMeasurements()
      .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

    let report = '\n📊 PERFORMANCE REPORT\n';
    report += '='.repeat(50) + '\n';

    completed.forEach(measurement => {
      const duration = measurement.duration?.toFixed(2) || 'N/A';
      report += `${measurement.name.padEnd(30)} ${duration.padStart(8)}ms\n`;
    });

    const total = this.getTotalLoadTime();
    if (total > 0) {
      report += '-'.repeat(50) + '\n';
      report += `Total Load Time:${' '.repeat(14)} ${total.toFixed(2)}ms\n`;
    }

    report += '='.repeat(50) + '\n';
    return report;
  }

  static enable(): void {
    this.enabled = true;
  }

  static disable(): void {
    this.enabled = false;
  }

  static clear(): void {
    this.measurements.clear();
  }
}

// Auto-start app initialization measurement
if (typeof window !== 'undefined') {
  PerformanceMonitor.startMeasurement('app-initialization');
}