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
          "group toast group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:shadow-md group-[.toaster]:backdrop-blur-sm",
        description: "group-[.toast]:text-muted-foreground",
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
