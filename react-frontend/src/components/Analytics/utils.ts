export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

export function getSourceTypeLabel(source: string): string {
  switch (source) {
    case 'react-frontend':
      return 'React Frontend';
    case 'extension':
      return 'Extension';
    case 'api':
      return 'API';
    default:
      return source;
  }
}
