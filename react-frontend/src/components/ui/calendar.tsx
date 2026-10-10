import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "../../lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/** Month-grid date picker (react-day-picker), styled for this app. Supports single, multiple and range modes. */
function Calendar({ className, classNames, showOutsideDays = false, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative", className)}
      classNames={{
        months: "flex flex-col gap-6 sm:flex-row",
        month: "space-y-3",
        month_caption: "flex h-8 items-center justify-center",
        caption_label: "text-sm font-semibold",
        nav: "absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between",
        button_previous:
          "grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-30 dark:hover:bg-neutral-800",
        button_next:
          "grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-30 dark:hover:bg-neutral-800",
        month_grid: "border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-[11px] font-medium text-muted-foreground",
        week: "mt-1 flex",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "h-9 w-9 rounded-md tabular-nums transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-neutral-800",
        today: "font-semibold [&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4",
        selected: "",
        // Range ends are solid; the days between sit on a track. In dark mode the track is a step lighter than
        // the popover (neutral-800 would vanish into it).
        range_start:
          "rounded-l-md bg-neutral-100 dark:bg-neutral-700 [&>button]:bg-neutral-900 [&>button]:text-white [&>button]:hover:bg-neutral-900 dark:[&>button]:bg-white dark:[&>button]:text-neutral-900 dark:[&>button]:hover:bg-white",
        range_end:
          "rounded-r-md bg-neutral-100 dark:bg-neutral-700 [&>button]:bg-neutral-900 [&>button]:text-white [&>button]:hover:bg-neutral-900 dark:[&>button]:bg-white dark:[&>button]:text-neutral-900 dark:[&>button]:hover:bg-white",
        range_middle:
          "bg-neutral-100 dark:bg-neutral-700 [&>button]:rounded-none [&>button]:hover:bg-neutral-200 dark:[&>button]:hover:bg-neutral-600",
        outside: "text-muted-foreground opacity-40",
        disabled: "text-muted-foreground opacity-30 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
