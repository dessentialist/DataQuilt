"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface HelpTipProps {
  content: React.ReactNode;
  ariaLabel?: string;
  buttonClassName?: string;
  iconClassName?: string;
  tooltipClassName?: string;
  popoverClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

// HelpTip shows a lightweight tooltip on hover and a popover on click.
// - Hover: Tooltip appears reliably
// - Click: Popover opens; clicking outside closes it
// Tooltip is hidden while popover is open to avoid overlap
export function HelpTip({
  content,
  ariaLabel = "More info",
  buttonClassName,
  iconClassName,
  tooltipClassName,
  popoverClassName,
  side = "right",
  align = "center",
}: HelpTipProps) {
  const [open, setOpen] = React.useState(false);
  // Standardized surface styles so hover (Tooltip) and click (Popover) look identical
  const surfaceClass = cn(
    "w-auto max-w-sm rounded-md border bg-popover px-3 py-1.5 text-sm whitespace-pre-line text-popover-foreground shadow-md",
    // Allow callers to extend/override
    popoverClassName,
  );

  return (
    <Tooltip>
      <Popover open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={ariaLabel}
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground",
                buttonClassName,
              )}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
            >
              <Info className={cn("h-4 w-4", iconClassName)} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <PopoverContent
          side={side}
          align={align}
          className={surfaceClass}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {content}
        </PopoverContent>
      </Popover>
      <TooltipContent
        side={side}
        align={align}
        className={cn(surfaceClass, tooltipClassName)}
        hidden={open}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}


