import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          style={{ maxWidth: width }}
          className="glass glass-strong fixed left-1/2 top-1/2 z-[71] w-[92vw] -translate-x-1/2 -translate-y-1/2 p-5 text-text-1"
        >
          <DialogPrimitive.Title className="display text-[17px]">{title}</DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 text-[12.5px] leading-relaxed text-text-3">
              {description}
            </DialogPrimitive.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-3 top-3 rounded-[7px] px-1.5 py-1 text-text-3 transition-colors hover:bg-bg-3 hover:text-text-1"
          >
            ✕
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
