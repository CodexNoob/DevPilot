import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProject, listSuites } from "@/features/projects/queries";
import { createTestCase } from "@/features/test-cases/actions";
import { TestCaseForm } from "@/features/test-cases/components/test-case-form";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New test case" };

export default function NewTestCasePage({ params, searchParams }: PageProps<"/projects/[projectId]/cases/new">) {
  return (
    <div className="space-y-8">
      <PageHeader title="New test case" description="Write the steps a visitor takes and what they should see." />
      <Suspense fallback={<Skeleton className="h-[32rem] max-w-3xl rounded-xl" />}>
        <NewTestCase params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewTestCase({ params, searchParams }: PageProps<"/projects/[projectId]/cases/new">) {
  await requireUser();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [suites, { suite }] = await Promise.all([listSuites(project.id), searchParams]);
  if (suites.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Create a test suite for {project.name} first.</p>
        <Link href={`/projects/${project.id}`} className={buttonVariants({ variant: "outline" })}>
          Back to project
        </Link>
      </div>
    );
  }

  return (
    <TestCaseForm
      action={createTestCase.bind(null, project.id)}
      suites={suites.map((s) => ({ id: s.id, name: s.name }))}
      defaultSuiteId={typeof suite === "string" ? suite : undefined}
      submitLabel="Create test case"
      cancelHref={`/projects/${project.id}#test-cases`}
    />
  );
}
