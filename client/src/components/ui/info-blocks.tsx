import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface InfoBlockProps {
  children: ReactNode;
  className?: string;
}

interface ExampleBlockProps extends InfoBlockProps {
  label?: string;
}

interface TipBlockProps extends InfoBlockProps {
  icon?: ReactNode;
}

interface CalloutBlockProps extends InfoBlockProps {
  title?: string;
}

// Example Block - Gradient style with icon
export function ExampleBlock({ label = "Example", children, className }: ExampleBlockProps) {
  return (
    <div className={cn(
      "mt-6 bg-amber-50/10 p-5 rounded-xl border-l-4 border-amber-300",
      className
    )}>
      <div>
        <p className="font-semibold text-amber-900 mb-1">{label}:</p>
        <div className="text-gray-800 text-sm whitespace-pre-line">{children}</div>
      </div>
    </div>
  );
}

// Tip Block - Speech bubble/callout style
export function TipBlock({ icon, children, className }: TipBlockProps) {
  return (
    <div className={cn("mt-6 relative", className)}>
      <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/60">
        <div className="absolute -top-2 left-6 w-4 h-4 bg-blue-50/50 border-l border-t border-blue-100/60 rotate-45"></div>
        <div className="text-gray-800 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold">
            Quick Tip:
          </span>{" "}
          {children}
        </div>
      </div>
    </div>
  );
}

// Callout Block - Minimal with left accent line
export function CalloutBlock({ title, children, className }: CalloutBlockProps) {
  return (
    <div className={cn(
      "mt-6 pl-5 border-l-2 border-oracle-accent/60",
      className
    )}>
      {title && (
        <p className="text-xs uppercase tracking-wider text-oracle-accent font-bold mb-2">
          {title}
        </p>
      )}
      <div className="oracle-muted text-base">{children}</div>
    </div>
  );
}

// Pro Tip variant with green checkmark
export function ProTipBlock({ children, className }: InfoBlockProps) {
  return (
    <div className={cn("mt-4 flex gap-3 items-start", className)}>
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <span className="text-green-600">✓</span>
      </div>
      <div className="text-sm oracle-muted">
        <span className="font-semibold text-green-700">Pro tip:</span> {children}
      </div>
    </div>
  );
}

// Badge Block - For labeled content
export function BadgeBlock({ label, children, className }: ExampleBlockProps) {
  return (
    <div className={cn(
      "mt-4 bg-purple-50/50 backdrop-blur rounded-lg p-4",
      className
    )}>
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <div className="px-2 py-1 bg-purple-100 rounded-full">
            <span className="text-xs font-bold text-purple-700">{label.toUpperCase()}</span>
          </div>
        </div>
      )}
      <div className="text-purple-900">{children}</div>
    </div>
  );
}