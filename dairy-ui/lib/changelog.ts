export interface ChangelogEntry {
  version: string;
  date: string;
  commit: string;
  status?: string;
  changes: string[];
}

export const changelogData: ChangelogEntry[] = [
  {
    version: 'v1.2.1',
    date: 'May 18, 2026',
    commit: 'Direct DB Update',
    status: 'Optimized & Latency-Protected',
    changes: [
      'Created Missing High-Frequency Indexes: Added MySQL database index idx_income_date and idx_expense_date to date-columns of the high-traffic transactions and reports tables.',
      'Aggregated Report Query Speedups: Drastically reduced dashboard metric load times by eliminating sequential full-table scans.',
      'Latency Protection: Shielded local development environments from AWS remote database network round-trip overhead on serial date aggregations.'
    ]
  },
  {
    version: 'v1.2.0',
    date: 'May 18, 2026',
    commit: 'bd3b3ab',
    status: 'Production-Ready & Responsive',
    changes: [
      'Split-Pane Master-Detail Directory: Replaced separate tabs for operations/management with a sleek, unified desktop side-by-side directory.',
      'Dynamic Database Mappings: Connected directly to backend MySQL columns employee_id and profile_pic. Unmapped/null IDs gracefully fall back to detailed field views.',
      'Strict Layout Heights & Widths: Shrank the main layout container to max-w-4xl and height to 360px, fitting exactly 5 records before engaging a smooth internal scrollbar.',
      'Alphabetical Sorting: Integrated client-side alphabetical list sorting ordered strictly by employeeId.',
      '+91 Phone Prefixing: Prepend India\'s country code prefix +91 automatically to contact listings.',
      'Mobile Swipe UX: Implemented full viewport toggles for mobile devices. Users start with a listing view, and tapping an employee transitions to a full-screen profile page with a back-button.'
    ]
  },
  {
    version: 'v1.1.5',
    date: 'May 18, 2026',
    commit: 'edbd4fd',
    status: 'Completed',
    changes: [
      'Dashboard NullPointerExceptions: Added missing Java stream collection null guards to 6-month financial data and month-to-date income/expense metrics in DashboardService.java.',
      'Local Dev Windows Address Mismatch: Updated Next.js rewrites config to route proxy destination explicitly to IPv4 127.0.0.1:8080 (resolving Windows IPv6 [::1] Connection Refused errors).',
      'Axios Relative Endpoint Fix: Corrected the hardcoded cloud URL in lib/api.ts to /api, ensuring local dev queries correctly route through the Next.js dev server proxy rules.',
      'Emblem Refinement: Integrated a custom dark green theme (#1B4332) and vector leaf branding assets.'
    ]
  },
  {
    version: 'v1.1.0',
    date: 'May 5, 2026',
    commit: '05a0b5b',
    changes: [
      'Form Modal Polish: Overhauled product form inputs and tenure selections to eliminate overflow scrolling glitches on narrow viewports.',
      'Tailwind Version Restructure: Synchronized postcss/autoprefixer rules with Tailwind stable version 3 configuration.'
    ]
  },
  {
    version: 'v1.0.0',
    date: 'April 27, 2026',
    commit: '74dcaac',
    status: 'Completed',
    changes: [
      'Core Architecture: Setup core multi-module project (Spring Boot back-end and React Next.js front-end).',
      'Subscription Engines: Integrated multi-tenure combo calculator for subscription packages.'
    ]
  }
];
