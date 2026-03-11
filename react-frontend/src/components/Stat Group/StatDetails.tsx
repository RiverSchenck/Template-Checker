import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { ValidationResult, ValidationCategory, CategoryDetail } from '../../types';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { CircularProgress } from './CircularProgress';
import { cn } from '../../lib/utils';

interface StatsToggleProps {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  seeDetails?: boolean;
}

const defaultKeys: (keyof ValidationResult)[] = [
  'par_styles',
  'char_styles',
  'text_boxes',
  'fonts',
  'images',
];

function calculateTotalIssuesFromCategory(categoryData?: CategoryDetail): number {
  if (categoryData?.details) {
    return Object.keys(categoryData.details).length;
  }
  return 0;
}

function calculateChange(current: number, previous: number): number {
  if (previous === undefined) return 0;
  return current - previous;
}

interface CategoryBlockProps {
  title: string;
  totalIssues: number;
  totalCount: number;
  changeFromPrevious?: number | null;
}

function CategoryBlock({ title, totalIssues, totalCount, changeFromPrevious }: CategoryBlockProps) {
  const correct = Math.max(0, totalCount - totalIssues);
  const pct = totalCount > 0 ? (correct / totalCount) * 100 : 0;
  const isComplete = pct >= 100;

  return (
    <Card
      className={cn(
        'relative flex min-h-[152px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm transition-shadow hover:shadow-md',
        isComplete && 'ring-1 ring-[#9a7efe]/20',
      )}
    >
      {/* Top accent when 100% */}
      {isComplete && (
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#9a7efe]/60 to-transparent" aria-hidden />
      )}
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-5">
        <span className="text-center text-sm font-medium text-foreground">
          {title}
        </span>
        <CircularProgress correct={correct} total={totalCount} className="shrink-0" />
        {changeFromPrevious !== undefined && changeFromPrevious !== null && (
          <Badge
            variant="outline"
            className={cn(
              'shrink-0 gap-1 border font-medium',
              changeFromPrevious > 0 && 'border-destructive/50 bg-destructive/10 text-destructive',
              changeFromPrevious < 0 && 'border-green-600/50 bg-green-600/10 text-green-600 dark:border-green-400/50 dark:bg-green-400/10 dark:text-green-400',
              changeFromPrevious === 0 && 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
            )}
          >
            {changeFromPrevious > 0 ? (
              <><ArrowUp className="h-3 w-3" />+{changeFromPrevious}</>
            ) : changeFromPrevious < 0 ? (
              <><ArrowDown className="h-3 w-3" />{changeFromPrevious}</>
            ) : (
              <><Minus className="h-3 w-3" />—</>
            )}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function StatsToggle({ jsonResponse, previousJsonResponse, seeDetails }: StatsToggleProps) {
  const [open, setOpen] = useState(!!previousJsonResponse || !!seeDetails);

  useEffect(() => {
    if (previousJsonResponse || seeDetails) {
      setOpen(true);
    }
  }, [previousJsonResponse, seeDetails]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="mt-2 flex w-full flex-col items-center">
        <CollapsibleContent forceMount className="w-full overflow-hidden">
          <motion.div
            className="w-full"
            initial={false}
            animate={{
              height: open ? 'auto' : 0,
              opacity: open ? 1 : 0,
            }}
            transition={{
              duration: 0.3,
              ease: [0.32, 0.72, 0, 1],
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="w-full rounded-xl bg-muted/20 px-3 py-2">
              <div className="grid w-full grid-cols-2 justify-center gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {defaultKeys.map((key, index) => {
                  const categoryData = jsonResponse[key] as CategoryDetail;
                  const categoryLabel = ValidationCategory[key as keyof typeof ValidationCategory] ?? 'Unknown';
                  const totalIssues = calculateTotalIssuesFromCategory(categoryData);
                  const totalCount = categoryData?.total_count ?? 0;

                  let changeFromPrevious: number | null = null;
                  if (previousJsonResponse) {
                    const prevCategory = previousJsonResponse[key] as CategoryDetail | undefined;
                    const prevIssues = calculateTotalIssuesFromCategory(prevCategory);
                    changeFromPrevious = calculateChange(totalIssues, prevIssues);
                  }

                  return (
                    <CategoryBlock
                      key={`${categoryLabel}-${index}`}
                      title={categoryLabel}
                      totalIssues={totalIssues}
                      totalCount={totalCount}
                      changeFromPrevious={changeFromPrevious}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        </CollapsibleContent>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 h-7 gap-1 px-1.5 text-[11px] text-muted-foreground"
            aria-expanded={open}
          >
            <motion.span
              className="inline-flex items-center gap-1"
              initial={false}
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            >
              <ChevronDown className="h-3 w-3" />
            </motion.span>
            {open ? 'Hide details' : 'Show details'}
          </Button>
        </CollapsibleTrigger>
      </div>
    </Collapsible>
  );
}

export default StatsToggle;
