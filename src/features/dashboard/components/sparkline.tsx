import { useId } from "react";
import { cn } from "@/lib/utils";
import { sparklinePaths } from "../metrics";

const WIDTH = 120;
const HEIGHT = 32;

export type SparklineTone = "positive" | "negative" | "neutral";

const TONE: Record<SparklineTone, string> = {
  positive: "text-emerald-500 dark:text-emerald-400",
  negative: "text-red-500 dark:text-red-400",
  neutral: "text-sky-500 dark:text-sky-400",
};

/**
 * Small area chart pinned to the bottom edge of a stat card. Pure SVG, server
 * rendered. `label` is the accessible summary; the shapes are decorative.
 */
export function Sparkline({
  values,
  label,
  tone = "neutral",
  domain,
  className,
}: {
  values: readonly (number | null)[];
  label: string;
  tone?: SparklineTone;
  domain?: [number, number];
  className?: string;
}) {
  const gradientId = useId();
  const paths = sparklinePaths(values, WIDTH, HEIGHT, domain);
  if (!paths) return null;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", TONE[tone], className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.25} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={paths.area} fill={`url(#${gradientId})`} aria-hidden />
      <path
        d={paths.line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        aria-hidden
      />
    </svg>
  );
}
