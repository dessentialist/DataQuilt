import * as React from "react";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  level?: 2 | 3 | 4 | 5 | 6;
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  subheader?: React.ReactNode;
  guide?: string;
  id?: string;
  actions?: React.ReactNode;
  variant?: "plain" | "card";
  className?: string;
  divider?: boolean;
};

export function SectionHeader({
  title,
  level = 2,
  icon,
  tooltip,
  subheader,
  guide,
  id,
  actions,
  variant = "plain",
  className,
  divider = true,
}: SectionHeaderProps) {
  const HeadingTag = ("h" + level) as keyof JSX.IntrinsicElements;
  const headingId = id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const containerClasses =
    variant === "card"
      ? cn("p-4 lg:p-6", divider ? "border-b border-oracle-border" : "")
      : "";

  return (
    <div className={cn(containerClasses, className)}>
      {icon ? (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          {/* Header row with icon + title inside the accent band */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 bg-oracle-accent-soft rounded px-3 py-1">
              <span aria-hidden="true" className="flex items-center">{icon}</span>
              <HeadingTag
                id={headingId}
                className="text-lg lg:text-xl font-semibold oracle-heading font-lato"
              >
                {title}
              </HeadingTag>
            </div>
            {subheader ? (
              <p className="text-xs oracle-muted oracle-mt-subheader">{subheader}</p>
            ) : null}
            {guide ? (
              <p className="text-sm oracle-muted oracle-mt-guide mt-2 lg:mt-3">{guide}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {tooltip}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 bg-oracle-accent-soft rounded px-3 py-1">
              <HeadingTag
                id={headingId}
                className="text-lg lg:text-xl font-semibold oracle-heading font-lato"
              >
                {title}
              </HeadingTag>
            </div>
            {subheader ? (
              <p className="text-xs oracle-muted oracle-mt-subheader">{subheader}</p>
            ) : null}
            {guide ? (
              <p className="text-sm oracle-muted oracle-mt-guide mt-2 lg:mt-3">{guide}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}


