import React from 'react';
import { ValidationType, ClassifierData, ValidationItem, ValidationCategory } from '../../../types';
import { getValidationTag, renderHelpLink } from '../../helpers';
import { cn } from '../../../lib/utils';

interface ValidationStyleProps {
  validationType: ValidationType;
  category: ValidationCategory;
  items: ValidationItem[];
  classifierData?: ClassifierData;
}

const ValidationStyle = ({
  validationType,
  category,
  items,
  classifierData,
}: ValidationStyleProps) => {
  const message = classifierData?.message ?? '';
  const label = classifierData?.label ?? '';
  const helpArticle = classifierData?.help_article ?? null;

  return (
    <div
      className={cn(
        'w-full rounded-lg border border-l-2 bg-muted/30 px-4 py-3',
        validationType === 'errors' && 'border-border/60 border-l-destructive',
        validationType === 'warnings' && 'border-border/60 border-l-amber-500',
        validationType === 'infos' && 'border-border/60 border-l-blue-500'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {getValidationTag(label, validationType, true)}
        </div>
        {helpArticle != null && <div className="shrink-0">{renderHelpLink(helpArticle)}</div>}
      </div>
      {message && (
        <p className="mt-2.5 text-base leading-snug text-foreground">
          {message}
        </p>
      )}
      {items.some((i) => i.context) && (
        <ul className="mt-2 list-none space-y-2 pl-0">
          {items
            .filter((i) => i.context)
            .map((item, index) => (
              <li
                key={`${item.page_id}-${item.data_id}-${index}`}
                className="rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
              >
                {item.context}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default ValidationStyle;
