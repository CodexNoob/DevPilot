import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { updateClientAction } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/components/client-form";
import { getClient } from "@/features/clients/queries";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Edit client" };

export default function EditClientPage({ params }: PageProps<"/clients/[clientId]/edit">) {
  return (
    <div className="space-y-8">
      <PageHeader title="Edit client" />
      <Suspense fallback={<Skeleton className="h-64 max-w-2xl rounded-xl" />}>
        <EditClient params={params} />
      </Suspense>
    </div>
  );
}

async function EditClient({ params }: Pick<PageProps<"/clients/[clientId]/edit">, "params">) {
  const { workspace, isAdmin } = await requireWorkspace();
  const { clientId } = await params;
  const client = await getClient(workspace.id, clientId);
  if (!client || !isAdmin) notFound();

  return (
    <div className="max-w-2xl">
      <ClientForm
        action={updateClientAction.bind(null, client.id)}
        client={client}
        submitLabel="Save changes"
        cancelHref={`/clients/${client.id}`}
      />
    </div>
  );
}
