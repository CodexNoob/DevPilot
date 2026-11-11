import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start testing your web apps with DevPilot.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<SignupFormSkeleton />}>
          <SignupForm />
        </Suspense>
      </CardContent>
      <CardFooter className="text-sm text-muted-foreground">
        Already have an account?&nbsp;
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}

function SignupFormSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-14" />
      <Skeleton className="h-8" />
    </div>
  );
}
