export interface AnalyticsSummary {
  summary: {
    total_runs: number;
    total_errors: number;
    total_warnings: number;
    total_infos: number;
    avg_duration_ms: number;
    avg_file_size_bytes: number;
    days: number;
  };
  source_types: {
    [key: string]: {
      count: number;
      total_errors: number;
      total_warnings: number;
      total_infos: number;
    };
  };
  all_validations: Array<{
    type: string;
    severity: string;
    count: number;
  }>;
  runs_over_time: Array<{
    date: string;
    runs: number;
    errors: number;
    warnings: number;
    infos: number;
  }>;
  errors_per_run_by_day?: Array<{
    date: string;
    errors_0: number;
    errors_1_5: number;
    errors_6_10: number;
    errors_11_15: number;
    errors_16_plus: number;
  }>;
  warnings_per_run_by_day?: Array<{
    date: string;
    warnings_0: number;
    warnings_1_5: number;
    warnings_6_10: number;
    warnings_11_15: number;
    warnings_16_plus: number;
  }>;
  infos_per_run_by_day?: Array<{
    date: string;
    infos_0: number;
    infos_1_5: number;
    infos_6_10: number;
    infos_11_15: number;
    infos_16_plus: number;
  }>;
  errorsHistogram?: { errors_0: number; errors_1_5: number; errors_6_10: number; errors_11_15: number; errors_16_plus: number };
  warningsHistogram?: { warnings_0: number; warnings_1_5: number; warnings_6_10: number; warnings_11_15: number; warnings_16_plus: number };
  infosHistogram?: { infos_0: number; infos_1_5: number; infos_6_10: number; infos_11_15: number; infos_16_plus: number };
  recent_runs: Array<any>;
}

export type RunsCategory = 'total' | 'web' | 'extension' | 'api';
export type IssuesPerRunCategory = 'errors' | 'warnings' | 'infos';
