/**
 * AdminUI — helpers for admin.html dashboard.
 * The full dashboard lives in admin.html (standalone page).
 * This module can be imported if the admin view is ever embedded.
 */
export class AdminUI {
  static computeMetrics(records) {
    const total = records.length;
    const passed = records.filter((r) => r.passed).length;
    const failed = total - passed;
    const avgScore =
      total === 0
        ? 0
        : Math.round(records.reduce((s, r) => s + r.score, 0) / total);
    return { total, passed, failed, avgScore };
  }

  static groupByModule(records) {
    const map = {};
    records.forEach((r) => {
      if (!map[r.moduleName]) map[r.moduleName] = [];
      map[r.moduleName].push(r);
    });
    return map;
  }
}
