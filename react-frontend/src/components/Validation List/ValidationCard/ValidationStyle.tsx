import React from 'react';
import { ValidationType, ClassifierData, ValidationItem, ValidationCategory, ContextDetails } from '../../../types';
import { getValidationTag, renderHelpLink, renderContextContent } from '../../helpers';
import { cn } from '../../../lib/utils';
import { notifyExtensionToHighlight } from '../../../utils/extensionHighlight';
import { LocateFixed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../ui/tooltip';
import { Badge } from '../../ui/badge';

interface ValidationStyleProps {
  validationType: ValidationType;
  category: ValidationCategory;
  items: ValidationItem[];
  classifierData?: ClassifierData;
  fromExtension?: boolean;
}

const ValidationStyle = ({
  validationType,
  category,
  items,
  classifierData,
  fromExtension = false,
}: ValidationStyleProps) => {
  const message = classifierData?.message ?? '';
  const label = classifierData?.label ?? '';
  const helpArticle = classifierData?.help_article ?? null;

  const handleIssueClick = (
    dataId: string,
    context?: string,
    context_details?: ContextDetails | null,
    spreadId?: string | null
  ) => {
    const textContent =
      context_details?.text != null
        ? [context_details.text]
        : context
          ? [context]
          : undefined;
    notifyExtensionToHighlight(dataId, textContent, spreadId);
  };

  const firstItemWithDataId = items.find((i) => i.data_id && i.data_id !== 'null');
  const hasContexts = items.some((i) => i.context);
  const showMessageHighlight = fromExtension && firstItemWithDataId && !hasContexts;

  const pageNames = Array.from(new Set(items.map((i) => i.page_name).filter(Boolean))) as string[];
  const pageLabel = pageNames.length === 1 ? pageNames[0] : pageNames.length > 1 ? pageNames.join(', ') : null;

  const messageContent = (
    <p
      className={cn(
        'mt-2.5 text-base leading-snug text-foreground flex items-start gap-2',
        showMessageHighlight &&
          'cursor-pointer rounded-md px-1 -mx-1 py-0.5 -my-0.5 hover:bg-primary/10 hover:underline transition-colors group'
      )}
      onClick={() =>
        showMessageHighlight &&
        handleIssueClick(
          firstItemWithDataId!.data_id,
          firstItemWithDataId!.context,
          firstItemWithDataId!.context_details,
          firstItemWithDataId!.spread_id
        )
      }
    >
      {(showMessageHighlight || (!hasContexts && pageLabel)) && (
        <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {showMessageHighlight && (
            <LocateFixed
              className="h-4 w-4 text-muted-foreground group-hover:text-primary"
              aria-hidden
            />
          )}
          {!hasContexts && pageLabel && (
            <Badge variant="secondary" className="text-[10px] font-medium">
              Page {pageLabel}
            </Badge>
          )}
        </span>
      )}
      <span className="flex-1 min-w-0">{message}</span>
    </p>
  );

  return (
    <TooltipProvider delayDuration={200}>
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
        {message &&
          (showMessageHighlight ? (
            <Tooltip>
              <TooltipTrigger asChild>{messageContent}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                Click to highlight on Frontify page
              </TooltipContent>
            </Tooltip>
          ) : (
            messageContent
          ))}
        {!hasContexts && items.length > 0 && items[0].context_details && (
          <div className="mt-2 min-w-0">
            {renderContextContent(items[0].context, items[0].context_details)}
          </div>
        )}
        {items.some((i) => i.context) && (
          <ul className="mt-2 list-none space-y-2 pl-0">
            {items
              .filter((i) => i.context)
              .map((item, index) => {
                const isClickable = item.data_id && item.data_id !== 'null';
                const showItemHighlight = fromExtension && isClickable;
                const itemContent = (
                  <li
                    key={`${item.page_id}-${item.data_id}-${index}`}
                    className={cn(
                      'rounded-md border border-border/50 px-3 py-2 text-sm leading-relaxed flex items-center gap-2',
                      showItemHighlight
                        ? 'cursor-pointer bg-background/50 hover:bg-primary/10 hover:border-primary/30 transition-colors group'
                        : 'bg-background/50 text-muted-foreground'
                    )}
                    onClick={() =>
                      showItemHighlight &&
                      handleIssueClick(item.data_id, item.context, item.context_details, item.spread_id)
                    }
                  >
                    {showItemHighlight && (
                      <span className="flex items-center gap-1.5 shrink-0">
                        <LocateFixed
                          className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary"
                          aria-hidden
                        />
                        {item.page_name && (
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            Page {item.page_name}
                          </Badge>
                        )}
                      </span>
                    )}
                    {!showItemHighlight && item.page_name && (
                      <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
                        Page {item.page_name}
                      </Badge>
                    )}
                    <span className="flex-1 min-w-0">{renderContextContent(item.context, item.context_details)}</span>
                  </li>
                );
                return showItemHighlight ? (
                  <Tooltip key={`${item.page_id}-${item.data_id}-${index}`}>
                    <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Click to highlight on Frontify page
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  itemContent
                );
              })}
          </ul>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ValidationStyle;
