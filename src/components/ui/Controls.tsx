import * as SliderPrimitive from "@radix-ui/react-slider";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  format,
  className = "",
  disabled,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: ReactNode;
  format?: (v: number) => string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-text-3">{label}</span>
          <span className="num text-[12px] text-accent">{format ? format(value) : value}</span>
        </div>
      )}
      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        className="relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-40"
        aria-label={typeof label === "string" ? label : "slider"}
      >
        <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-bg-3">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border border-accent bg-bg-0 shadow-[0_0_10px_-1px_var(--color-accent)] transition-transform hover:scale-110 focus-visible:outline-none" />
      </SliderPrimitive.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled,
  tone = "accent",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  tone?: "accent" | "warn";
}) {
  const on = tone === "warn" ? "bg-warn" : "bg-accent";
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[12px] text-text-1">{label}</div>
        {hint && <div className="mt-0.5 text-[10.5px] leading-snug text-text-3">{hint}</div>}
      </div>
      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={typeof label === "string" ? label : "toggle"}
        className="relative h-[18px] w-[32px] shrink-0 rounded-full border border-line bg-bg-3 transition-colors data-[state=checked]:border-transparent data-[disabled]:opacity-40"
      >
        <SwitchPrimitive.Thumb
          className={`block h-3.5 w-3.5 translate-x-0.5 rounded-full bg-text-3 transition-transform data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-bg-0 ${
            checked ? "" : ""
          }`}
          style={checked ? { background: "var(--color-bg-0)" } : undefined}
        />
        {checked && <span className={`pointer-events-none absolute inset-0 rounded-full ${on} opacity-20`} />}
      </SwitchPrimitive.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text input                                                          */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  hint,
  disabled,
  className = "",
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="eyebrow mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`h-9 w-full rounded-[8px] border border-line bg-bg-1 px-3 text-[13px] text-text-1 placeholder:text-text-3 transition-colors focus:border-accent/60 focus:outline-none disabled:opacity-50 ${
          mono ? "num" : ""
        }`}
      />
      {hint && <span className="mt-1 block text-[10.5px] text-text-3">{hint}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Native select, styled                                               */
/* ------------------------------------------------------------------ */

export function Select({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="eyebrow mb-1.5 block">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none rounded-[8px] border border-line bg-bg-1 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%236A7280%22 stroke-width=%221.6%22><path d=%22M3 4.5 6 8l3-3.5%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat px-3 pr-8 text-[12.5px] text-text-1 transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-bg-2">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist row (preflight / upload policy)                           */
/* ------------------------------------------------------------------ */

export function CheckRow({
  ok,
  label,
  detail,
  mono,
}: {
  ok: boolean;
  label: ReactNode;
  detail?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span
        className={`mt-[2px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] ${
          ok ? "border-ok/60 bg-ok/15 text-ok" : "border-warn/60 bg-warn/15 text-warn"
        }`}
        aria-hidden
      >
        {ok ? "✓" : "!"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-text-1">{label}</div>
        {detail && <div className={`mt-0.5 text-[10.5px] leading-snug text-text-3 ${mono ? "num" : ""}`}>{detail}</div>}
      </div>
      <span className="sr-only">{ok ? "passed" : "attention needed"}</span>
    </div>
  );
}
