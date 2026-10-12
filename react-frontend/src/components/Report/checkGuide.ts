import type { CheckGuide, ValidationResult, ValidationType } from '../../types';

export type { CheckGuide, SubjectKind } from '../../types';

/**
 * The plain-language copy for a check. The backend writes it (python_backend/app/customer_summary/check_guides.py)
 * and sends it with the results; package and parsing errors, and results from older backends, fall back to the
 * check's label and message.
 */
export function getCheckGuide(
  guides: ValidationResult['check_guides'],
  severity: ValidationType,
  key: string,
  label?: string,
  message?: string
): CheckGuide {
  return (
    guides?.[severity]?.[key] ?? {
      title: label || message || key,
      why: message || '',
      fix: [],
      subject: 'document',
    }
  );
}
