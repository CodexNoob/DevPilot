import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRightIcon,
  BuildingIcon,
  CalendarClockIcon,
  CameraIcon,
  CheckCircle2Icon,
  CodeIcon,
  FolderKanbanIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MonitorPlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WavesIcon,
  XCircleIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "DevPilot · Automated browser testing with AI" },
  description:
    "Write or generate browser tests, run them in real Chromium, and review every result with logs and screenshots.",
};

/*
 * Signed-out home page. Every feature listed here exists in the product today;
 * keep it that way (see IMPLEMENTATION_AUDIT.md: no claims ahead of the code).
 */

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
] as const;

export default function HomePage() {
  return (
    <div id="top" className="relative flex flex-1 flex-col overflow-x-clip">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-backdrop-filter:bg-background/55">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "rounded-full px-4")}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative isolate">
      <BackgroundGlow />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-28 lg:pb-28">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-chart-2 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-chart-2" />
            </span>
            Real Chromium. Real results.
          </span>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Test smarter.{" "}
            <span className="bg-linear-to-r from-primary via-chart-5 to-primary bg-clip-text text-transparent">
              Catch bugs earlier.
            </span>{" "}
            Ship with confidence.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            DevPilot turns plain-language test ideas into browser tests, runs them in real Chromium, and keeps every
            result, log and screenshot so your team knows exactly what broke.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group h-11 rounded-full px-6 text-base shadow-lg shadow-primary/25",
              )}
            >
              Start testing
              <ArrowRightIcon
                className="transition-transform motion-safe:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <a
              href="#how-it-works"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-full px-6 text-base")}
            >
              See how it works
            </a>
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {["Playwright engine", "Claude-powered generator", "Team workspaces"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-4 text-chart-2" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function BackgroundGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Fine grid that fades out toward the edges. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-size-[48px_48px] opacity-60" />
      <div className="absolute -top-40 left-1/2 h-144 w-4xl -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute top-40 -right-40 size-112 rounded-full bg-chart-5/15 blur-3xl" />
    </div>
  );
}

/* Static, illustrative preview of the real step language and run view. */
function ProductPreview() {
  const steps: { action: string; args: string }[] = [
    { action: "goto", args: "/login" },
    { action: "fill", args: '"#email" "qa@acme.dev"' },
    { action: "fill", args: '"#password" "••••••••"' },
    { action: "click", args: '"role=button[name=Sign in]"' },
    { action: "expect-url", args: "/dashboard" },
    { action: "expect-visible", args: '"text=Welcome back"' },
  ];
  const results = [
    { name: "Login with valid credentials", ok: true, ms: "2.4s" },
    { name: "Rejects a wrong password", ok: true, ms: "1.9s" },
    { name: "Checkout total updates", ok: false, ms: "4.1s" },
    { name: "Search returns results", ok: true, ms: "3.2s" },
  ];

  return (
    <div
      className="relative motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:delay-150 motion-safe:duration-1000 motion-safe:fill-mode-[both]"
      role="img"
      aria-label="Example: a login test written in DevPilot's step language, and a test run with three passing tests and one failing test."
    >
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-4xl bg-linear-to-br from-primary/25 via-transparent to-chart-5/25 blur-2xl" />

      {/* Editor card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-chart-3/70" />
            <span className="size-2.5 rounded-full bg-chart-4/70" />
            <span className="size-2.5 rounded-full bg-chart-2/70" />
          </div>
          <span className="font-mono text-xs text-muted-foreground">login.test · Smoke suite</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Example
          </span>
        </div>
        {/* Extra bottom padding on sm+ leaves room for the overlapping run card. */}
        <ol className="overflow-x-auto px-4 pt-4 pb-4 font-mono text-[13px] leading-7 sm:pb-14">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-4 whitespace-nowrap">
              <span className="w-4 shrink-0 text-right text-muted-foreground/50 select-none">{i + 1}</span>
              <span>
                <span className={step.action.startsWith("expect") ? "text-chart-2" : "text-primary"}>
                  {step.action}
                </span>{" "}
                <span className="text-muted-foreground">{step.args}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Run result card, overlapping */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur sm:-mt-10 sm:ml-12 lg:-mr-6">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold">Run #128</span>
            <span className="truncate text-muted-foreground">Smoke · main</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-chart-3/15 px-2 py-0.5 text-xs font-medium text-chart-3">
            <XCircleIcon className="size-3.5" aria-hidden /> 1 failed
          </span>
        </div>
        <ul className="divide-y divide-border">
          {results.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {r.ok ? (
                <CheckCircle2Icon className="size-4 shrink-0 text-chart-2" aria-hidden />
              ) : (
                <XCircleIcon className="size-4 shrink-0 text-chart-3" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              {!r.ok && <CameraIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.ms}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

type Feature = { icon: LucideIcon; title: string; body: string; className?: string; accent?: string };

const FEATURES: Feature[] = [
  {
    icon: MonitorPlayIcon,
    title: "Runs in a real browser",
    body: "A dedicated Playwright worker executes every test in an isolated Chromium context. Queue a run and watch it go from queued to passed or failed live.",
    className: "md:col-span-2",
    accent: "from-primary/15",
  },
  {
    icon: SparklesIcon,
    title: "AI test generator",
    body: "Describe a flow in plain English. Claude drafts the tests; you review and edit every step before anything is saved or run.",
    accent: "from-chart-5/15",
  },
  {
    icon: CodeIcon,
    title: "Readable step language",
    body: "goto, click, fill, expect-text and more. Validated line by line, with clear errors. No arbitrary code.",
  },
  {
    icon: CameraIcon,
    title: "Evidence for every failure",
    body: "Step-by-step logs, durations, console errors and a screenshot of the moment a test failed.",
  },
  {
    icon: CalendarClockIcon,
    title: "Scheduled runs",
    body: "Cron schedules with time zones, per project and suite. Pause and resume any time.",
  },
  {
    icon: WavesIcon,
    title: "Flaky test detection",
    body: "Spot tests that both pass and fail over the last 30 days, ranked by failure rate from real history.",
    accent: "from-chart-4/15",
  },
  {
    icon: UsersIcon,
    title: "Team workspaces",
    body: "Invite teammates as owners, admins or members. Every workspace's data is isolated in the database itself.",
    accent: "from-chart-2/15",
  },
  {
    icon: BuildingIcon,
    title: "Clients and projects",
    body: "Organise websites by client, with suites, test cases and schedules per project.",
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Everything from first test to flaky-test hunt"
          body="One place to write, generate, run and review browser tests for every site your team ships."
        />
        <ul className="mt-14 grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, className, accent }) => (
            <li
              key={title}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40",
                className,
              )}
            >
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 bg-linear-to-br to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100",
                  accent ?? "from-primary/10",
                )}
              />
              <div className="relative">
                <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
                  <Icon className="size-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const STEPS = [
  {
    icon: FolderKanbanIcon,
    title: "Add your project",
    body: "Register the website URL, pick the environment, and group it under a client if you like.",
  },
  {
    icon: SparklesIcon,
    title: "Write or generate tests",
    body: "Use the step editor, or let the AI generator draft tests from a description. You approve every one.",
  },
  {
    icon: MonitorPlayIcon,
    title: "Run and review",
    body: "Run on demand or on a schedule. Results, logs and screenshots are kept for every run.",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-border/60 bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="How it works" title="From URL to test results in three steps" />
        <div className="relative mt-14">
          <div
            aria-hidden
            className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-border to-transparent md:block"
          />
          <ol className="relative grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative flex flex-col items-center text-center">
                <div className="relative flex size-12 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

const SECURITY = [
  {
    icon: LockKeyholeIcon,
    title: "Isolation in the database",
    body: "Postgres Row Level Security checks workspace membership on every row, not just in the UI.",
  },
  {
    icon: CodeIcon,
    title: "No arbitrary code",
    body: "Tests use an allowlisted step language. AI output is validated against it before it can be saved.",
  },
  {
    icon: KeyRoundIcon,
    title: "Privileged key stays server-side",
    body: "Only the test worker holds the service key. The browser app runs with your own permissions.",
  },
  {
    icon: CameraIcon,
    title: "Private evidence",
    body: "Screenshots live in a private bucket and are shown through short-lived signed links.",
  },
] as const;

function Security() {
  return (
    <section id="security" className="scroll-mt-20 border-t border-border/60 py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheckIcon className="size-6 text-primary" aria-hidden />
          </div>
          <SectionHeading
            align="left"
            eyebrow="Security"
            title="Built for teams that test other people's software"
            body="Your clients' sites, credentials and results deserve the same care as production code."
          />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SECURITY.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center sm:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute -top-24 left-1/2 h-72 w-160 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-60 w-96 rounded-full bg-chart-5/15 blur-3xl" />
        </div>
        <div className="relative">
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Your first test run is a few minutes away
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Create a workspace, add a site, and generate your first tests.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 rounded-full px-6 text-base shadow-lg shadow-primary/25",
              )}
            >
              Create your account <ArrowRightIcon aria-hidden />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-11 rounded-full px-6 text-base")}
            >
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-card/35">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/35 to-transparent" />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 py-12 sm:grid-cols-[2fr_1fr_1fr] sm:py-14 lg:gap-12">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Reliable browser testing for teams that want to catch regressions before their users do.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-chart-2" aria-hidden />
              Playwright-powered quality checks
            </div>
          </div>

          <FooterLinkGroup
            title="Product"
            links={[
              { label: "How it works", href: "#how-it-works" },
              { label: "Features", href: "#features" },
              { label: "Security", href: "#security" },
            ]}
          />
          <FooterLinkGroup
            title="Get started"
            links={[
              { label: "Create an account", href: "/signup" },
              { label: "Sign in", href: "/login" },
            ]}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border/60 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© DevPilot. AI-powered software testing &amp; QA.</p>
          <a href="#top" className="w-fit transition-colors hover:text-foreground">
            Back to top <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-4 space-y-3">
        {links.map(({ label, href }) => (
          <li key={label}>
            <a href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "mt-6")}>
      <p className="text-sm font-semibold tracking-wide text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body && <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{body}</p>}
    </div>
  );
}
