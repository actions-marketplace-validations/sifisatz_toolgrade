"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarMenuButton,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";

export function NavLink({
  href,
  exact,
  children,
  sub,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
  sub?: boolean;
}) {
  const path = usePathname();
  const active = exact
    ? path === href
    : path === href || path.startsWith(`${href}/`);
  const link = <Link href={href} />;
  return sub ? (
    <SidebarMenuSubButton isActive={active} render={link}>
      {children}
    </SidebarMenuSubButton>
  ) : (
    <SidebarMenuButton isActive={active} render={link}>
      {children}
    </SidebarMenuButton>
  );
}
