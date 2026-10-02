import React from 'react';
import { ValidationType, ClassifierData, ValidationItem, ValidationCategory } from '../../../types';
import { getValidationTag, renderHelpLink, renderContextContent } from '../../helpers';
import { cn } from '../../../lib/utils';
import { Badge } from '../../ui/badge';

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

  const hasContexts = items.some((i) => i.context);

  const pageNames = Array.from(new Set(items.map((i) => i.page_name).filter(Boolean))) as string[];
  const pageLabel = pageNames.length === 1 ? pageNames[0] : pageNames.length > 1 ? pageNames.join(', ') : null;

  const messageContent = (
    <p className="mt-2.5 text-base leading-snug text-foreground flex items-start gap-2">
      {!hasContexts && pageLabel && (
        <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <Badge variant="secondary" className="text-[10px] font-medium">
            Page {pageLabel}
          </Badge>
        </span>
      )}
      <span className="flex-1 min-w-0">{message}</span>
    </p>
  );

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
      {message && messageContent}
      {!hasContexts && items.length > 0 && items[0].context_details && (
        <div className="mt-2 min-w-0">
          {renderContextContent(items[0].context, items[0].context_details)}
        </div>
      )}
      {items.some((i) => i.context) && (
        <ul className="mt-2 list-none space-y-2 pl-0">
          {items
            .filter((i) => i.context)
            .map((item, index) => (
              <li
                key={`${item.page_id}-${item.data_id}-${index}`}
                className="rounded-md border border-border/50 px-3 py-2 text-sm leading-relaxed flex items-center gap-2 bg-background/50 text-muted-foreground"
              >
                {item.page_name && (
                  <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
                    Page {item.page_name}
                  </Badge>
                )}
                <span className="flex-1 min-w-0">{renderContextContent(item.context, item.context_details)}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
};

export default ValidationStyle;
