
'use client';

import Link from 'next/link';
import { ChitLogo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { Home, LogIn, UserPlus, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useRouter, usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

export function AppSidebar() {
  const { user, logOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { state: sidebarState } = useSidebar(); // Get sidebar state for conditional rendering

  const handleLogout = async () => {
    await logOut();
    router.push('/login');
  };

  const getInitials = (email?: string | null) => {
    if (!email) return 'U';
    return email.substring(0, 2).toUpperCase();
  };

  const isExpanded = sidebarState === 'expanded';

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left">
      <SidebarHeader className="p-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Chit Home">
          <ChitLogo className="h-8 w-auto text-primary" />
        </Link>
        {/* Optional: Add a trigger here if needed, or rely on AppTopBar's trigger */}
      </SidebarHeader>
      <SidebarContent className="flex-grow">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/'}
              tooltip={isExpanded ? undefined : "Home"}
            >
              <Link href="/" className="flex items-center">
                <Home />
                {isExpanded && <span>Home</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Add other navigation items here */}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t border-sidebar-border">
        {loading ? (
          isExpanded ? (
            <div className="flex items-center space-x-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>
            </div>
          ) : (
            <Skeleton className="h-10 w-10 rounded-full mx-auto" />
          )
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={`w-full items-center gap-2 px-2 ${isExpanded ? 'justify-start' : 'justify-center h-12'}`}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                </Avatar>
                {isExpanded && (
                  <div className="flex flex-col items-start truncate">
                    <span className="text-sm font-medium truncate text-sidebar-foreground">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" side="top" align={isExpanded ? "start" : "center"} sideOffset={10}>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className={`flex gap-2 ${isExpanded ? 'flex-col' : 'flex-col items-center'}`}>
            <Button
              variant="outline"
              asChild
              className="w-full"
              title={isExpanded ? "" : "Login"}
            >
              <Link href="/login" className={`flex items-center ${isExpanded ? 'justify-center' : 'justify-center aspect-square p-0 w-10 h-10'}`}>
                <LogIn />
                {isExpanded && <span className="ml-2">Login</span>}
              </Link>
            </Button>
            <Button
              asChild
              className="w-full"
              title={isExpanded ? "" : "Sign Up"}
            >
              <Link href="/signup" className={`flex items-center ${isExpanded ? 'justify-center' : 'justify-center aspect-square p-0 w-10 h-10'}`}>
                <UserPlus />
                {isExpanded && <span className="ml-2">Sign Up</span>}
              </Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
