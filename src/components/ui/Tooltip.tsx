import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tip({
  children,
  content,
  side = "top",
  delay = 120,
}: {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={7}
          collisionPadding={12}
          className="z-[80] max-w-[280px] rounded-[8px] border border-line-strong bg-bg-2/95 px-2.5 py-1.5 text-[11.5px] leading-snug text-text-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,.9)] backdrop-blur"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[var(--color-line-strong)]" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
