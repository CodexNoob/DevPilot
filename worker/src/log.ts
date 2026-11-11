type Level = "info" | "warn" | "error";

/** Structured one-line logs: timestamp, level, message, then key=value fields. */
export function log(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  const extra = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : String(v)}`)
    .join(" ");
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}${extra ? ` ${extra}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 20)}\n… [truncated]`;
}
