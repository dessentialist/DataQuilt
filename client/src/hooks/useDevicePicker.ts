import { useState, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type PickerKind = "template" | "system" | string;

/**
 * useDevicePicker centralizes device‑aware disclosure logic for UI pickers.
 * - Mobile: drives a centered modal via mobileOpenIndex
 * - Desktop: drives a popover via desktopOpenIndex
 * Exposes a single open/close API so components don't need viewport branching.
 */
export function useDevicePicker(kind: PickerKind) {
  const isMobile = useIsMobile();

  // Desktop popover index; null means closed
  const [desktopOpenIndex, setDesktopOpenIndex] = useState<number | null>(null);
  // Mobile modal index; null means closed
  const [mobileOpenIndex, setMobileOpenIndex] = useState<number | null>(null);

  const open = useCallback((index: number) => {
    if (isMobile) {
      setMobileOpenIndex(index);
    } else {
      setDesktopOpenIndex(index);
    }
    console.log(`[useDevicePicker] open kind=${kind} index=${index} isMobile=${isMobile}`);
  }, [isMobile, kind]);

  const close = useCallback(() => {
    if (isMobile) {
      setMobileOpenIndex(null);
    } else {
      setDesktopOpenIndex(null);
    }
    console.log(`[useDevicePicker] close kind=${kind} isMobile=${isMobile}`);
  }, [isMobile, kind]);

  const desktop = {
    openIndex: desktopOpenIndex,
    onOpenChange: (index: number, isOpen: boolean) => {
      console.log(`[useDevicePicker] desktop onOpenChange kind=${kind} index=${index} ->`, isOpen);
      setDesktopOpenIndex(isOpen ? index : null);
    },
  } as const;

  const mobile = {
    openIndex: mobileOpenIndex,
  } as const;

  return {
    isMobile,
    open,
    close,
    desktop,
    mobile,
    shouldRenderDesktopActions: !isMobile,
    shouldRenderMobileActions: isMobile,
  } as const;
}


