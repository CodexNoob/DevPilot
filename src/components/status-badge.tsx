import { CheckCircle2Icon, CircleDashedIcon, Loader2Icon, MinusCircleIcon, TimerIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Enums } from "@/lib/supabase/database.types";

type StatusStyle = { label: string; className: string; icon: LucideIcon; spin?: boolean };

const RUN_STATUS: Record<Enums<"test_run_status">, StatusStyle> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground", icon: CircleDashedIcon },
  running: {
    label: "Running",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    icon: Loader2Icon,
    spin: true,
  },
  passed: { label: "Passed", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2Icon },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-700 dark:text-red-300", icon: XCircleIcon },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", icon: MinusCircleIcon },
  error: { label: "Error", className: "bg-amber-500/15 text-amber-800 dark:text-amber-300", icon: TriangleAlertIcon },
};

const RESULT_STATUS: Record<Enums<"test_result_status">, StatusStyle> = {
  passed: RUN_STATUS.passed,
  failed: RUN_STATUS.failed,
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground", icon: MinusCircleIcon },
  timed_out: { label: "Timed out", className: "bg-red-500/15 text-red-700 dark:text-red-300", icon: TimerIcon },
};

function StatusBadge({ style }: { style: StatusStyle }) {
  const Icon = style.icon;
  return (
    <Badge variant="secondary" className={cn("gap-1 border-transparent", style.className)}>
      <Icon className={cn("size-3", style.spin && "animate-spin motion-reduce:animate-none")} aria-hidden />
      {style.label}
    </Badge>
  );
}

export function RunStatusBadge({ status }: { status: Enums<"test_run_status"> }) {
  return <StatusBadge style={RUN_STATUS[status]} />;
}

export function ResultStatusBadge({ status }: { status: Enums<"test_result_status"> }) {
  return <StatusBadge style={RESULT_STATUS[status]} />;
}

const ENVIRONMENT_LABEL: Record<Enums<"project_environment">, string> = {
  production: "Production",
  staging: "Staging",
  development: "Development",
};

export function EnvironmentBadge({ environment }: { environment: Enums<"project_environment"> }) {
  return <Badge variant="outline">{ENVIRONMENT_LABEL[environment]}</Badge>;
}

export const ENVIRONMENT_OPTIONS = Object.entries(ENVIRONMENT_LABEL).map(([value, label]) => ({ value, label }));
