import type { ChartConfig } from '../ui/chart';

export const RECENT_RUNS_PAGE_SIZE = 10;
export const MAX_ANALYTICS_DAYS = 365;

export const runsChartConfig = {
  runs: {
    label: 'Total',
    color: '#9a7efe',
  },
  react_frontend: {
    label: 'Web',
    color: '#9a7efe',
  },
  extension: {
    label: 'Extension',
    color: '#9a7efe',
  },
  api: {
    label: 'API',
    color: '#9a7efe',
  },
} satisfies ChartConfig;

export const issuesChartConfig = {
  errors: {
    label: 'Errors',
    color: 'var(--destructive)',
  },
  warnings: {
    label: 'Warnings',
    color: 'var(--warning)',
  },
  infos: {
    label: 'Infos',
    color: 'var(--info)',
  },
} satisfies ChartConfig;

export const barChartConfig = {
  count: {
    label: 'Count',
    color: 'hsl(var(--chart-1))',
  },
  error: {
    label: 'Error',
    color: 'var(--destructive)',
  },
  warning: {
    label: 'Warning',
    color: 'var(--warning)',
  },
  info: {
    label: 'Info',
    color: 'var(--info)',
  },
} satisfies ChartConfig;

export const ISSUES_PER_RUN_PURPLE = '#9a7efe';
export const errorsPerRunChartConfig = {
  count: { label: 'Runs', color: ISSUES_PER_RUN_PURPLE },
  errors_0: { label: '0', color: ISSUES_PER_RUN_PURPLE },
  errors_1_5: { label: '1–5', color: ISSUES_PER_RUN_PURPLE },
  errors_6_10: { label: '6–10', color: ISSUES_PER_RUN_PURPLE },
  errors_11_15: { label: '11–15', color: ISSUES_PER_RUN_PURPLE },
  errors_16_plus: { label: '16+', color: ISSUES_PER_RUN_PURPLE },
} satisfies ChartConfig;

export const sourcePieColors = ['#c4b5fd', '#8b5cf6', '#5b21b6'];
export const severityPieColors = ['var(--destructive)', 'var(--warning)', 'var(--info)'];
