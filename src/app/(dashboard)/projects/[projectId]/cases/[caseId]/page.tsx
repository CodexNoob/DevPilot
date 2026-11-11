import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SparklesIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getProject, listSuites } from "@/features/projects/queries";
import { updateTestCase } from "@/features/test-cases/actions";
import { DeleteTestCaseButton } from "@/features/test-cases/components/delete-test-case-button";
import { TestCaseForm } from "@/features/test-cases/components/test-case-form";
import { getTestCase } from "@/features/test-cases/queries";
import { requireUser } from "@/lib/auth";
import { formatStepsText, testStepsSchema } from "@/lib/test-steps";

export const metadata: Metadata = { title: "Edit test case" };

export default function EditTestCasePage({ params }: PageProps<"/projects/[projectId]/cases/[caseId]">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-[32rem] max-w-3xl rounded-xl" />
        </div>
      }
    >
      <EditTestCase params={params} />
    </Suspense>
  );
}

async function EditTestCase({ params }: Pick<PageProps<"/projects/[projectId]/cases/[caseId]">, "params">) {
  await requireUser();
  const { projectId, caseId } = await params;
  const [project, testCase] = await Promise.all([getProject(projectId), getTestCase(projectId, caseId)]);
  if (!project || !testCase) notFound();

  const suites = await listSuites(project.id);
  // Stored steps were validated on write; tolerate legacy/bad data by showing JSON.
  const parsedSteps = testStepsSchema.safeParse(testCase.steps);
  const stepsText = parsedSteps.success
    ? formatStepsText(parsedSteps.data)
    : `# Could not read the saved steps:\n# ${JSON.stringify(testCase.steps)}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {testCase.name}
            {testCase.source === "ai" && (
              <Badge variant="secondary" className="gap-1">
                <SparklesIcon aria-hidden /> AI generated
              </Badge>
            )}
          </span>
        }
        description={project.name}
        actions={<DeleteTestCaseButton projectId={project.id} caseId={testCase.id} caseName={testCase.name} />}
      />
      <TestCaseForm
        action={updateTestCase.bind(null, project.id, testCase.id)}
        suites={suites.map((s) => ({ id: s.id, name: s.name }))}
        testCase={{ name: testCase.name, description: testCase.description, suiteId: testCase.suite_id, stepsText }}
        submitLabel="Save changes"
        cancelHref={`/projects/${project.id}#test-cases`}
      />
    </div>
  );
}
