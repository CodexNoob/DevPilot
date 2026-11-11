import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BuildingIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClientAction } from "@/features/clients/actions";
import { ClientForm } from "@/features/clients/components/client-form";
import { listClients } from "@/features/clients/queries";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Clients" description="The customers your projects are built and tested for." />
      <Suspense fallback={<ClientsSkeleton />}>
        <ClientsContent />
      </Suspense>
    </div>
  );
}

async function ClientsContent() {
  const { workspace, isAdmin } = await requireWorkspace();
  const clients = await listClients(workspace.id);

  return (
    <>
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Add client</CardTitle>
            <CardDescription>Group projects by the client they belong to.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClientForm action={createClientAction} submitLabel="Add client" />
          </CardContent>
        </Card>
      )}

      {clients.length === 0 ? (
        <EmptyState
          icon={BuildingIcon}
          title="No clients yet"
          description={
            isAdmin
              ? "Add your first client above, then assign projects to it."
              : "A workspace admin can add clients and assign projects to them."
          }
        />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {client.contact_email ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Link href={`/projects?client=${client.id}`} className="hover:underline">
                        {client.projectCount}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                      <time dateTime={client.created_at} title={formatDateTime(client.created_at)}>
                        {timeAgo(client.created_at)}
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function ClientsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading clients">
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
