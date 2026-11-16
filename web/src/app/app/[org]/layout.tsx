import { BookOpen, FlaskConical, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LogoMark } from "@/components/logo";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrg, listProjects } from "@/lib/data";

export default function OrgLayout({
  children,
  params,
}: LayoutProps<"/app/[org]">) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Suspense fallback={<Skeleton className="h-10 w-full" />}>
            <OrgHeader params={params} />
          </Suspense>
        </SidebarHeader>
        <SidebarContent>
          <Suspense
            fallback={
              <SidebarGroup className="gap-2">
                <Skeleton className="h-7 w-4/5" />
                <Skeleton className="h-7 w-3/5" />
              </SidebarGroup>
            }
          >
            <ProjectNav params={params} />
          </Suspense>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/#how-it-works" />}>
                <BookOpen />
                <span>How it works</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground sm:inline-flex">
              <FlaskConical className="size-3.5" aria-hidden />
              Demo workspace - no sign-in
            </span>
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function OrgHeader({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const org = await getOrg(slug);
  if (!org) notFound();
  return (
    <Link
      href={`/app/${org.slug}`}
      className="flex items-center gap-2 rounded-md p-1.5 hover:bg-sidebar-accent"
    >
      <LogoMark className="size-7 shrink-0" />
      <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
        <span className="text-sm font-semibold">ToolGrade</span>
        <span className="text-xs text-muted-foreground">{org.name}</span>
      </div>
    </Link>
  );
}

async function ProjectNav({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const org = await getOrg(slug);
  if (!org) return null;
  const list = await listProjects(org.id);
  const base = `/app/${org.slug}`;
  return (
    <>
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <NavLink href={base} exact>
              <LayoutGrid />
              <span>Overview</span>
            </NavLink>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Projects</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {list.map((p) => (
              <SidebarMenuItem key={p.id}>
                <NavLink href={`${base}/${p.slug}`} exact>
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background: p.latest
                        ? p.latest.gatePassed
                          ? "var(--status-good)"
                          : "var(--status-critical)"
                        : "var(--border)",
                    }}
                    aria-hidden
                  />
                  <span className="truncate">{p.name}</span>
                </NavLink>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <NavLink sub href={`${base}/${p.slug}/compare`}>
                      Compare runs
                    </NavLink>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <NavLink sub href={`${base}/${p.slug}/settings`}>
                      Settings & CI
                    </NavLink>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
