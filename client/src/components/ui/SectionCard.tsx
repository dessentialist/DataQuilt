import * as React from "react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/SectionHeader";

type SectionCardProps = {
  id: string;
  title: string;
  level?: 2 | 3 | 4 | 5 | 6;
  icon?: React.ReactNode;
  tooltip?: React.ReactNode;
  subheader?: React.ReactNode;
  guide?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  headerDivider?: boolean;
};

export function SectionCard({
  id,
  title,
  level = 2,
  icon,
  tooltip,
  subheader,
  guide,
  actions,
  className,
  children,
  headerDivider = true,
}: SectionCardProps) {
  return (
    <section aria-labelledby={id} className={cn("bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden", className)}>
      <SectionHeader
        id={id}
        title={title}
        level={level}
        icon={icon}
        tooltip={tooltip}
        subheader={subheader}
        guide={guide}
        variant="card"
        actions={actions}
        divider={headerDivider}
      />
      <div className="p-6">
        {children}
      </div>
    </section>
  );
}


