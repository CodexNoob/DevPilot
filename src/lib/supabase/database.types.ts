// Mirrors supabase/migrations in the format produced by `supabase gen types`.
// Once a Supabase project is linked, regenerate with `npm run db:types`.
// tests/db/types.test.ts guards enums and table names against drift.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };
type OptionalTimestamps = { created_at?: string; updated_at?: string };

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      generation_rate_limits: {
        Row: { hits: string[]; updated_at: string; user_id: string };
        Insert: { hits?: string[]; updated_at?: string; user_id: string };
        Update: { hits?: string[]; updated_at?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: "generation_rate_limits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: Timestamps & {
          contact_email: string | null;
          id: string;
          name: string;
          notes: string | null;
          workspace_id: string;
        };
        Insert: OptionalTimestamps & {
          contact_email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          workspace_id: string;
        };
        Update: OptionalTimestamps & {
          contact_email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      issues: {
        Row: Timestamps & {
          created_by: string | null;
          description: string | null;
          id: string;
          project_id: string;
          severity: Database["public"]["Enums"]["issue_severity"];
          status: Database["public"]["Enums"]["issue_status"];
          test_result_id: string | null;
          title: string;
        };
        Insert: OptionalTimestamps & {
          created_by?: string | null;
          description?: string | null;
          id?: string;
          project_id: string;
          severity?: Database["public"]["Enums"]["issue_severity"];
          status?: Database["public"]["Enums"]["issue_status"];
          test_result_id?: string | null;
          title: string;
        };
        Update: OptionalTimestamps & {
          created_by?: string | null;
          description?: string | null;
          id?: string;
          project_id?: string;
          severity?: Database["public"]["Enums"]["issue_severity"];
          status?: Database["public"]["Enums"]["issue_status"];
          test_result_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "issues_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: Timestamps & {
          display_name: string | null;
          email: string | null;
          id: string;
        };
        Insert: OptionalTimestamps & {
          display_name?: string | null;
          email?: string | null;
          id: string;
        };
        Update: OptionalTimestamps & {
          display_name?: string | null;
          email?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      page_snapshots: {
        Row: {
          created_at: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          path: string;
          project_id: string;
          requested_by: string | null;
          snapshot: Json | null;
          started_at: string | null;
          status: "queued" | "running" | "done" | "failed";
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          path: string;
          project_id: string;
          requested_by?: string | null;
          snapshot?: Json | null;
          started_at?: string | null;
          status?: "queued" | "running" | "done" | "failed";
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          path?: string;
          project_id?: string;
          requested_by?: string | null;
          snapshot?: Json | null;
          started_at?: string | null;
          status?: "queued" | "running" | "done" | "failed";
        };
        Relationships: [
          {
            foreignKeyName: "page_snapshots_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_snapshots_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: Timestamps & {
          base_url: string;
          client_id: string | null;
          created_by: string | null;
          description: string | null;
          environment: Database["public"]["Enums"]["project_environment"];
          id: string;
          name: string;
          workspace_id: string;
        };
        Insert: OptionalTimestamps & {
          base_url: string;
          client_id?: string | null;
          created_by?: string | null;
          description?: string | null;
          environment?: Database["public"]["Enums"]["project_environment"];
          id?: string;
          name: string;
          workspace_id: string;
        };
        Update: OptionalTimestamps & {
          base_url?: string;
          client_id?: string | null;
          created_by?: string | null;
          description?: string | null;
          environment?: Database["public"]["Enums"]["project_environment"];
          id?: string;
          name?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_fk";
            columns: ["client_id", "workspace_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "workspace_id"];
          },
        ];
      };
      schedules: {
        Row: Timestamps & {
          branch: string;
          created_by: string | null;
          cron: string;
          enabled: boolean;
          id: string;
          last_run_at: string | null;
          name: string;
          next_run_at: string | null;
          project_id: string;
          suite_id: string | null;
          timezone: string;
        };
        Insert: OptionalTimestamps & {
          branch?: string;
          created_by?: string | null;
          cron: string;
          enabled?: boolean;
          id?: string;
          last_run_at?: string | null;
          name: string;
          next_run_at?: string | null;
          project_id: string;
          suite_id?: string | null;
          timezone?: string;
        };
        Update: OptionalTimestamps & {
          branch?: string;
          created_by?: string | null;
          cron?: string;
          enabled?: boolean;
          id?: string;
          last_run_at?: string | null;
          name?: string;
          next_run_at?: string | null;
          project_id?: string;
          suite_id?: string | null;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedules_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_suite_fk";
            columns: ["suite_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_suites";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      test_cases: {
        Row: Timestamps & {
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          project_id: string;
          source: Database["public"]["Enums"]["test_case_source"];
          steps: Json;
          suite_id: string;
        };
        Insert: OptionalTimestamps & {
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          project_id: string;
          source?: Database["public"]["Enums"]["test_case_source"];
          steps: Json;
          suite_id: string;
        };
        Update: OptionalTimestamps & {
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
          source?: Database["public"]["Enums"]["test_case_source"];
          steps?: Json;
          suite_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_cases_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_cases_suite_fk";
            columns: ["suite_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_suites";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      test_results: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          id: string;
          logs: string | null;
          page_errors: Json;
          project_id: string;
          run_id: string;
          screenshot_path: string | null;
          status: Database["public"]["Enums"]["test_result_status"];
          test_case_id: string | null;
          test_name: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          logs?: string | null;
          page_errors?: Json;
          project_id: string;
          run_id: string;
          screenshot_path?: string | null;
          status: Database["public"]["Enums"]["test_result_status"];
          test_case_id?: string | null;
          test_name: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          id?: string;
          logs?: string | null;
          page_errors?: Json;
          project_id?: string;
          run_id?: string;
          screenshot_path?: string | null;
          status?: Database["public"]["Enums"]["test_result_status"];
          test_case_id?: string | null;
          test_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_results_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_results_run_fk";
            columns: ["run_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_runs";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "test_results_test_case_fk";
            columns: ["test_case_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_cases";
            referencedColumns: ["id", "project_id"];
          },
        ];
      };
      test_runs: {
        Row: {
          branch: string;
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          failed_count: number;
          finished_at: string | null;
          id: string;
          number: number;
          passed_count: number;
          project_id: string;
          schedule_id: string | null;
          skipped_count: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["test_run_status"];
          suite_id: string | null;
          total_count: number;
          trigger: Database["public"]["Enums"]["test_run_trigger"];
          triggered_by: string | null;
        };
        Insert: {
          branch?: string;
          created_at?: string;
          error_message?: string | null;
          failed_count?: number;
          finished_at?: string | null;
          id?: string;
          passed_count?: number;
          project_id: string;
          schedule_id?: string | null;
          skipped_count?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["test_run_status"];
          suite_id?: string | null;
          total_count?: number;
          trigger?: Database["public"]["Enums"]["test_run_trigger"];
          triggered_by?: string | null;
        };
        Update: {
          branch?: string;
          created_at?: string;
          error_message?: string | null;
          failed_count?: number;
          finished_at?: string | null;
          id?: string;
          passed_count?: number;
          project_id?: string;
          schedule_id?: string | null;
          skipped_count?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["test_run_status"];
          suite_id?: string | null;
          total_count?: number;
          trigger?: Database["public"]["Enums"]["test_run_trigger"];
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "test_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "test_runs_suite_fk";
            columns: ["suite_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "test_suites";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "test_runs_schedule_fk";
            columns: ["schedule_id", "project_id"];
            isOneToOne: false;
            referencedRelation: "schedules";
            referencedColumns: ["id", "project_id"];
          },
          {
            foreignKeyName: "test_runs_triggered_by_fkey";
            columns: ["triggered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      test_suites: {
        Row: Timestamps & {
          description: string | null;
          id: string;
          name: string;
          project_id: string;
        };
        Insert: OptionalTimestamps & {
          description?: string | null;
          id?: string;
          name: string;
          project_id: string;
        };
        Update: OptionalTimestamps & {
          description?: string | null;
          id?: string;
          name?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "test_suites_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_invitations: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["workspace_role"];
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["workspace_role"];
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["workspace_role"];
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          role: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          role?: Database["public"]["Enums"]["workspace_role"];
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: Timestamps & {
          created_by: string | null;
          id: string;
          name: string;
        };
        Insert: OptionalTimestamps & {
          created_by?: string | null;
          id?: string;
          name: string;
        };
        Update: OptionalTimestamps & {
          created_by?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      flaky_tests: {
        Row: {
          failed_runs: number;
          failure_rate: number;
          last_failed_at: string | null;
          last_run_at: string;
          passed_runs: number;
          project_id: string;
          test_name: string;
          total_runs: number;
        };
        Relationships: [
          {
            foreignKeyName: "test_results_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_invitation: { Args: { p_invitation_id: string }; Returns: string };
      cancel_run: { Args: { p_run_id: string }; Returns: boolean };
      claim_due_schedules: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["schedules"]["Row"][];
      };
      claim_next_page_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["page_snapshots"]["Row"][];
      };
      claim_next_run: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["test_runs"]["Row"][];
      };
      create_workspace: { Args: { p_name: string }; Returns: string };
      my_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          workspace_id: string;
          workspace_name: string;
          role: Database["public"]["Enums"]["workspace_role"];
          invited_by_name: string | null;
          created_at: string;
        }[];
      };
      run_daily_stats: {
        Args: { p_workspace_id: string; p_days?: number };
        Returns: {
          day: string;
          passed: number;
          failed: number;
          total: number;
          avg_duration_ms: number | null;
        }[];
      };
      take_generation_rate_limit: {
        Args: Record<PropertyKey, never>;
        Returns: { allowed: boolean; retry_after_ms: number }[];
      };
    };
    Enums: {
      issue_severity: "low" | "medium" | "high" | "critical";
      issue_status: "open" | "in_progress" | "resolved" | "closed";
      project_environment: "production" | "staging" | "development";
      test_case_source: "manual" | "ai";
      test_result_status: "passed" | "failed" | "skipped" | "timed_out";
      test_run_status: "queued" | "running" | "passed" | "failed" | "cancelled" | "error";
      test_run_trigger: "manual" | "scheduled" | "api";
      workspace_role: "owner" | "admin" | "member";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: ["open", "in_progress", "resolved", "closed"],
      project_environment: ["production", "staging", "development"],
      test_case_source: ["manual", "ai"],
      test_result_status: ["passed", "failed", "skipped", "timed_out"],
      test_run_status: ["queued", "running", "passed", "failed", "cancelled", "error"],
      test_run_trigger: ["manual", "scheduled", "api"],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const;
