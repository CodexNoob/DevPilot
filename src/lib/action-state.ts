import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

/** Serializable result returned by Server Actions to `useActionState`. */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      fieldErrors?: FieldErrors;
      /** Submitted values, so the form can be repopulated after React resets it. */
      values?: Record<string, string>;
    };

export const idleState: ActionState = { status: "idle" };

export function validationError(error: z.ZodError, values?: Record<string, string>): ActionState {
  return {
    status: "error",
    message: "Please fix the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as FieldErrors,
    values,
  };
}

type DbError = { code?: string; message: string } | null | undefined;

type DbErrorOptions = {
  /** Friendly messages for specific unique constraints, keyed by constraint name. */
  uniqueViolations?: Record<string, { field: string; message: string }>;
  values?: Record<string, string>;
};

/**
 * Maps a PostgREST/Postgres error to a user-facing message without leaking
 * internal details. Unknown errors get a generic message and are logged
 * server-side.
 */
export function databaseError(error: DbError, options: DbErrorOptions = {}): ActionState {
  const { values } = options;
  switch (error?.code) {
    case "23505": {
      const match = Object.entries(options.uniqueViolations ?? {}).find(([constraint]) =>
        error.message.includes(constraint),
      );
      if (match) {
        const [, { field, message }] = match;
        return { status: "error", message, fieldErrors: { [field]: [message] }, values };
      }
      return { status: "error", message: "That record already exists.", values };
    }
    case "23514":
    case "22001":
      return { status: "error", message: "Some values were rejected as invalid.", values };
    case "42501":
      return { status: "error", message: "You don't have permission to do that.", values };
    default:
      console.error("[database]", error);
      return { status: "error", message: "Something went wrong. Please try again.", values };
  }
}

/** Reads string fields from FormData, ignoring files and missing keys. */
export function formValues<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}
