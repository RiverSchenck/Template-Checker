"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ theme = "dark", ...props }: ToasterProps) => (
  <Sonner
    theme={theme}
    className="toaster group"
    icons={{
      success: <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      info: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      warning: <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      error: <OctagonX className="h-4 w-4 text-destructive" />,
      loading: <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />,
    }}
    toastOptions={{
      classNames: {
        toast:
          "group toast group-[.toaster]:gap-2.5 group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:px-3.5 group-[.toaster]:py-3 group-[.toaster]:text-sm group-[.toaster]:text-foreground group-[.toaster]:shadow-lg group-[.toaster]:shadow-black/20",
        title: "group-[.toast]:font-medium group-[.toast]:leading-snug",
        description: "group-[.toast]:text-muted-foreground",
        closeButton:
          "group-[.toast]:!left-auto group-[.toast]:!right-1 group-[.toast]:!top-1 group-[.toast]:!translate-x-0 group-[.toast]:!translate-y-0 group-[.toast]:!border-0 group-[.toast]:!bg-transparent group-[.toast]:text-muted-foreground hover:group-[.toast]:!bg-muted hover:group-[.toast]:text-foreground",
        actionButton:
          "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
        cancelButton:
          "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
      },
    }}
    {...props}
  />
)
export { Toaster }
