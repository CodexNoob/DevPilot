import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FolderKanbanIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GeneratorForm } from "@/features/generator/components/generator-form";
import { listGeneratorProjects } from "@/features/generator/queries";
import { isGeneratorConfigured } from "@/lib/server-env";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Test Generator" };

export default function GeneratorPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Test Generator"
        description="Describe a user flow and let Claude draft browser tests for it."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <GeneratorContent />
      </Suspense>
    </div>
  );
}

async function GeneratorContent() {
  const { workspace } = await requireWorkspace();

  if (!isGeneratorConfigured()) {
    return (
      <Alert role="status">
        <KeyRoundIcon />
        <AlertTitle>Test Generator isn&rsquo;t set up</AlertTitle>
        <AlertDescription>
          Add an Anthropic API key as <code className="font-mono">ANTHROPIC_API_KEY</code> to the server environment
          (for local development, <code className="font-mono">.env.local</code>) and restart the app.
        </AlertDescription>
      </Alert>
    );
  }

  const projects = await listGeneratorProjects(workspace.id);
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanbanIcon}
        title="Create a project first"
        description="Tests are generated for a project's website."
        action={
          <Link href="/projects/new" className={buttonVariants()}>
            <PlusIcon /> New project
          </Link>
        }
      />
    );
  }

  return <GeneratorForm projects={projects} />;
}
