import React, { useEffect, useState } from "react";
import { Check, FileText, Image, LayoutTemplate, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CheckResult, Results } from "../../types";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../../lib/utils";
import type { Report } from "./buildReport";

/** One is picked per template (by name), so the same result always says the same thing. */
const HEADLINES = [
  "Template champion.",
  "Spotless. Not a single issue.",
  "Clean as a whistle.",
  "Nothing to fix. Go grab a coffee.",
  "Chef’s kiss. Every check passed.",
  "Flawless. Frontify will love this one.",
];

type SubjectKind = Results["checks"][number]["subject_kinds"][number];

/** The rings: which checks each covers (by the subject kind a check is about) and what it says it looked at. */
const AREAS: {
  label: string;
  icon: LucideIcon;
  kinds: SubjectKind[];
  covered: (r: Results) => string;
}[] = [
  {
    label: "Fonts",
    icon: Type,
    kinds: ["font"],
    covered: (r) => plural(r.subjects_checked.font, "font"),
  },
  {
    label: "Images",
    icon: Image,
    kinds: ["image", "image_frame"],
    covered: (r) => plural(r.subjects_checked.image, "image"),
  },
  {
    label: "Text",
    icon: FileText,
    kinds: ["paragraph_style", "character_style", "text_frame"],
    covered: (r) =>
      plural(
        (r.subjects_checked.paragraph_style ?? 0) +
          (r.subjects_checked.character_style ?? 0),
        "style",
      ) +
      " · " +
      plural(r.subjects_checked.text_frame, "frame"),
  },
  {
    label: "Layout",
    icon: LayoutTemplate,
    kinds: ["document", "page_item"],
    covered: (r) => plural(r.pages.length, "page"),
  },
];

const RING_DELAY_MS = 220;
const RING_FILL_MS = 650;

// Results already shown, so coming back to the page shows the rings closed instead of playing them again.
const played = new WeakSet<CheckResult>();

function plural(n: number | undefined, word: string): string {
  const count = n ?? 0;
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function headlineFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return HEADLINES[Math.abs(hash) % HEADLINES.length];
}

/** A ring that fills, then closes in green with a check. */
function Ring({
  icon: Icon,
  closed,
  animate,
  delay,
}: {
  icon: LucideIcon;
  closed: boolean;
  animate: boolean;
  delay: number;
}) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="5"
          className="stroke-muted"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={closed ? 0 : circumference}
          className={cn(
            "stroke-green-500",
            animate &&
              "transition-[stroke-dashoffset] ease-out motion-reduce:transition-none",
          )}
          style={{
            transitionDuration: `${RING_FILL_MS}ms`,
            transitionDelay: `${delay}ms`,
          }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <Icon
          className={cn(
            "h-5 w-5 text-muted-foreground transition-opacity duration-200",
            closed && "opacity-0",
          )}
          style={{
            transitionDelay: closed ? `${delay + RING_FILL_MS}ms` : "0ms",
          }}
          aria-hidden
        />
        <span
          className={cn(
            "absolute grid h-7 w-7 place-items-center rounded-full bg-green-500 text-white opacity-0",
            closed &&
              (animate
                ? "motion-safe:animate-[clean-pop_450ms_cubic-bezier(0.34,1.56,0.64,1)_both] motion-reduce:opacity-100"
                : "opacity-100"),
          )}
          style={{ animationDelay: `${delay + RING_FILL_MS}ms` }}
        >
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
        </span>
      </span>
    </div>
  );
}

/** What a result with no issues at all shows: rings closing for each area checked, then the pages. */
export function CleanResult({
  result,
  report,
  templateName,
  pageViewer,
}: {
  result: CheckResult;
  report: Report;
  templateName: string;
  pageViewer: React.ReactNode | null;
}) {
  // A fresh result starts open and closes on the next frame; one seen before starts closed, without animating.
  const [animate] = useState(() => !played.has(result));
  const [closed, setClosed] = useState(() => played.has(result));
  useEffect(() => {
    played.add(result);
    if (closed) return;
    // After the open rings have painted, so the fill animates (safe to run twice, as StrictMode does).
    const timer = setTimeout(() => setClosed(true), 60);
    return () => clearTimeout(timer);
  }, [result, closed]);

  const { results } = result;
  const areas = AREAS.map((area) => ({
    ...area,
    checks: report.passedChecks.filter((c) =>
      area.kinds.includes(c.subject_kinds[0]),
    ),
  }))
    .filter((area) => area.checks.length > 0)
    // Kerning and tint are checked on paragraph and character styles alike: list each title once.
    .map((area) => ({
      ...area,
      titles: Array.from(new Set(area.checks.map((c) => c.title))),
    }));

  return (
    <>
      <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-card px-6 py-8 text-center">
        <p className="text-lg font-semibold text-foreground">
          {headlineFor(templateName)}
        </p>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-5">
          {areas.map((area, i) => (
            <Tooltip key={area.label}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex w-28 flex-col items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Ring
                    icon={area.icon}
                    closed={closed}
                    animate={animate}
                    delay={i * RING_DELAY_MS}
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium text-foreground">
                      {area.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {area.covered(results)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {plural(area.checks.length, "check")} passed
                    </span>
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-left">
                <p className="mb-1 font-medium">None of these were found:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {area.titles.map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          All {report.passedChecks.length} checks passed. The checker can’t
          catch everything, so give it a quick look in Frontify too.
        </p>
      </div>
      {pageViewer}
    </>
  );
}
