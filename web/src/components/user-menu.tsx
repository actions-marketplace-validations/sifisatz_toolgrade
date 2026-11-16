"use client";

import { Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

interface Props {
  user: { name: string; email: string };
  currentOrg: string;
  orgs: Array<{ slug: string; name: string; role: string }>;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export function UserMenu({ user, currentOrg, orgs }: Props) {
  const router = useRouter();
  const role = orgs.find((o) => o.slug === currentOrg)?.role;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
            {role ? ` - ${role}` : ""}
          </span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-60" side="top" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {orgs.map((o) => (
            <DropdownMenuItem
              key={o.slug}
              onClick={() => router.push(`/app/${o.slug}`)}
            >
              <span className="flex-1 truncate">{o.name}</span>
              {o.slug === currentOrg && (
                <Check className="size-4" aria-label="current" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => router.push("/onboarding?new=1")}>
            <Plus /> New workspace
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
