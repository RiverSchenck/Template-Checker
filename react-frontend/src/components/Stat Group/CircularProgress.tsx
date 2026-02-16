import React from 'react';

const STROKE_COLOR = '#9a7efe';
const SIZE = 64;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface CircularProgressProps {
  /** Number of "correct" items (e.g. total_count - issues) */
  correct: number;
  /** Total count for this category */
  total: number;
  /** Optional className for the wrapper */
  className?: string;
}

export function CircularProgress({ correct, total, className }: CircularProgressProps) {
  const percentage = total > 0 ? (correct / total) * 100 : 0;
  const strokeDashoffset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
  const isComplete = percentage >= 100;

  return (
    <div className={className} style={{ width: SIZE, height: SIZE, position: 'relative' }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-muted-foreground/30"
        />
        {/* Progress circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center text-xs tabular-nums"
        style={{ color: isComplete ? STROKE_COLOR : 'var(--muted-foreground)' }}
      >
        {correct} / {total}
      </div>
    </div>
  );
}
