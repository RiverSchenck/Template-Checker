import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  CloudUpload,
  FileCheck,
  BarChart3,
  ListChecks,
  PlugZap,
  Users,
  Inbox,
  KeyRound,
  LogOut,
  MessageSquareText,
  MoreVertical,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from '../ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { CheckResult } from '../../types';
import { Skeleton } from '../ui/skeleton';
import FrontifyLogo from '../../assets/frontifyLogo.svg';
import FrontifyNook from '../../assets/frontifyNook.svg';
import { useAuth } from '../AuthContext';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { periodSearch } from '../Analytics/urlState';

export interface SidebarMenuProps {
  checkerResults: CheckResult | null;
}

function pathnameToItemId(pathname: string, hash: string): string {
  if (pathname === '/' || pathname === '') return 'upload-template';
  if (pathname.startsWith('/results')) return 'results';
  if (pathname.startsWith('/analytics/operations')) return 'analytics-operations';
  if (pathname.startsWith('/analytics/checks')) return 'analytics-checks';
  if (pathname.startsWith('/analytics/api')) return 'analytics-api';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/admin/access-requests')) return 'admin-access-requests';
  if (pathname.startsWith('/admin/summary-feedback')) return 'admin-summary-feedback';
  if (pathname.startsWith('/my-feedback')) return 'my-feedback';
  if (pathname.startsWith('/admin/users')) return hash === '#access-requests' ? 'admin-access-requests' : 'admin-users';
  return 'upload-template';
}

export default function SidebarMenuComponent({ checkerResults }: SidebarMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, signOut, isAdmin, loadingRole, session } = useAuth();
  const { state: sidebarState } = useSidebar();
  const activeId = pathnameToItemId(location.pathname, location.hash || '');
  const [accessRequestCount, setAccessRequestCount] = useState<number>(0);

  useEffect(() => {
    if (!isAdmin || !session?.access_token) {
      setAccessRequestCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${baseURL}/admin/access-requests?status=pending`, {
          headers: getAuthHeaders(session.access_token),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (!cancelled) setAccessRequestCount(list.length);
      } catch {
        if (!cancelled) setAccessRequestCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, session?.access_token]);

  const displayName =
    currentUser?.display_name ?? currentUser?.email ?? '';
  const avatarUrl = currentUser?.avatar_url ?? null;
  const avatarLetter = (displayName || '?').charAt(0).toUpperCase();
  const isCollapsed = sidebarState === 'collapsed';
  // Moving between analytics pages keeps the chosen dates.
  const toAnalytics = (path: string) =>
    navigate(path + (location.pathname.startsWith('/analytics') ? periodSearch(new URLSearchParams(location.search)) : ''));

  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
                <img
                  src={isCollapsed ? FrontifyNook : FrontifyLogo}
                  alt="Frontify"
                  className="h-8 max-w-[140px] object-contain"
                />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Template Checker section */}
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel className="h-auto min-h-0 px-2 pb-1.5 pt-0 text-[13px] font-medium text-sidebar-foreground/60">
            Template Checker
          </SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-0.5">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Check Template"
                  isActive={activeId === 'upload-template'}
                  onClick={() => navigate('/')}
                >
                  <CloudUpload className="h-4 w-4" />
                  <span>Check Template</span>
                </SidebarMenuButton>
                {checkerResults && (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        isActive={activeId === 'results'}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          navigate('/results');
                        }}
                        href="/results"
                      >
                        <FileCheck className="h-4 w-4" />
                        <span>Results</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Analytics"
                  isActive={activeId === 'analytics'}
                  onClick={() => toAnalytics('/analytics')}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin section: user management and the admin-only analytics pages */}
        {isAdmin && !loadingRole && (
          <SidebarGroup className="mt-3">
            <SidebarGroupLabel className="h-auto min-h-0 px-2 pb-1.5 pt-0 text-[13px] font-medium text-sidebar-foreground/60">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-0.5">
              <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Users"
                      isActive={activeId === 'admin-users'}
                      onClick={() => navigate('/admin/users')}
                    >
                      <Users className="h-4 w-4" />
                      <span>Users</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Access requests"
                      isActive={activeId === 'admin-access-requests'}
                      onClick={() => navigate('/admin/users#access-requests')}
                    >
                      <Inbox className="h-4 w-4" />
                      <span>Access requests</span>
                      {accessRequestCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-xs font-medium text-sidebar-accent-foreground">
                          {accessRequestCount > 99 ? '99+' : accessRequestCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Summary feedback"
                      isActive={activeId === 'admin-summary-feedback'}
                      onClick={() => navigate('/admin/summary-feedback')}
                    >
                      <MessageSquareText className="h-4 w-4" />
                      <span>Summary feedback</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {[
                    { id: 'analytics-operations', path: '/analytics/operations', label: 'Operations', icon: Activity },
                    { id: 'analytics-checks', path: '/analytics/checks', label: 'All checks', icon: ListChecks },
                    { id: 'analytics-api', path: '/analytics/api', label: 'API usage', icon: PlugZap },
                  ].map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        isActive={activeId === item.id}
                        onClick={() => toAnalytics(item.path)}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        {!currentUser && loadingRole && (
          <div className="flex items-center gap-2 p-2" aria-hidden>
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </div>
          </div>
        )}
        {currentUser && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground focus-visible:ring-neutral-600 focus-visible:ring-offset-0 data-[state=open]:ring-neutral-600 data-[state=open]:ring-offset-0"
                  >
                    <Avatar className="h-8 w-8 rounded-lg">
                      {avatarUrl && !avatarError && (
                        <AvatarImage
                          src={avatarUrl}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarError(true)}
                        />
                      )}
                      <AvatarFallback className="rounded-lg" delayMs={0}>
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate">{displayName}</span>
                    </div>
                    <MoreVertical className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" sideOffset={4} className="border-neutral-700">
                  <DropdownMenuItem onClick={() => navigate('/api-keys')} className="focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-neutral-600">
                    <KeyRound className="mr-2 h-4 w-4" />
                    API keys
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/my-feedback')} className="focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-neutral-600">
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Your feedback
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()} className="focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-neutral-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
