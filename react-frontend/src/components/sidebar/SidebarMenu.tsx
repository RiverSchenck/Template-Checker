import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CloudUpload,
  FileCheck,
  BarChart3,
  Users,
  LogOut,
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
import { ValidationResult } from '../../types';
import FrontifyLogo from '../../assets/frontifyLogo.svg';
import FrontifyNook from '../../assets/frontifyNook.svg';
import { useAuth } from '../AuthContext';

export interface SidebarMenuProps {
  checkerResults: ValidationResult | null;
}

function pathnameToItemId(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'upload-template';
  if (pathname.startsWith('/results')) return 'results';
  if (pathname.startsWith('/analytics')) return 'analytics';
  if (pathname.startsWith('/admin/users')) return 'admin-users';
  return 'upload-template';
}

export default function SidebarMenuComponent({ checkerResults }: SidebarMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isAdmin, loadingRole } = useAuth();
  const { state: sidebarState } = useSidebar();
  const activeId = pathnameToItemId(location.pathname);

  const displayName =
    user?.user_metadata?.name ?? user?.email ?? '';
  const avatarUrl =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const avatarLetter = (displayName || '?').charAt(0).toUpperCase();
  const isCollapsed = sidebarState === 'collapsed';

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
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-1">
            <SidebarMenu>
              {/* Check Template (parent) with Results as sub-item */}
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
              {/* Analytics */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Analytics"
                  isActive={activeId === 'analytics'}
                  onClick={() => navigate('/analytics')}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {(loadingRole || isAdmin) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={loadingRole ? 'Loading...' : 'User management'}
                    isActive={!loadingRole && activeId === 'admin-users'}
                    onClick={() => !loadingRole && isAdmin && navigate('/admin/users')}
                    disabled={loadingRole}
                    className={loadingRole ? 'opacity-60 pointer-events-none' : undefined}
                  >
                    <Users className="h-4 w-4" />
                    <span>User management</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && (
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
