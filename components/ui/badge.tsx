import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "border-cyan-700/40 bg-cyan-900/30 text-cyan-300",
        ok: "border-emerald-700/40 bg-emerald-900/30 text-emerald-300",
        warn: "border-amber-700/40 bg-amber-900/30 text-amber-300",
        fail: "border-red-700/40 bg-red-900/30 text-red-300",
        info: "border-zinc-700/40 bg-zinc-800/40 text-zinc-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
