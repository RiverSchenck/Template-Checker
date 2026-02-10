// eslint-disable-next-line import/named
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  CloudUploadOutlined,
  FileDoneOutlined,
  BarChartOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { ValidationResult } from '../types';
import FrontifyLogo from '../assets/frontifyLogo.svg';
import FrontifyNook from '../assets/frontifyNook.svg';
import { useMenu } from './MenuContext';
import { useAuth } from './AuthContext';
import '../App.css';

const { Sider } = Layout;

interface SidebarMenuProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  checkerResults: ValidationResult | null;
}

function SidebarMenu({
  collapsed,
  setCollapsed,
  checkerResults,
}: SidebarMenuProps) {
  const { menuKey, setMenuKey } = useMenu();
  const { user, signOut } = useAuth();

  // Debug: inspect auth state in SidebarMenu
  console.log('[SidebarMenu] user:', user);
  console.log('[SidebarMenu] user?.user_metadata:', user?.user_metadata);
  console.log('[SidebarMenu] user?.email:', user?.email);

  const displayName =
    user?.user_metadata?.name ??
    user?.email ??
    '';
  const avatarUrl =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const avatarLetter = (displayName || '?').charAt(0).toUpperCase();

  console.log('[SidebarMenu] displayName:', displayName, 'avatarUrl:', avatarUrl, 'showUserBlock:', !!user);

  const logoutMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Log out',
      onClick: () => signOut(),
    },
  ];

  const onCollapse = (isCollapsed: boolean) => {
    setCollapsed(isCollapsed);
  };

  const handleMenuSelect = ({ key }: { key: string }) => {
    setMenuKey(key);
  };

  return (
    <div className="sidebar-menu">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={onCollapse}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          backgroundColor: '#6C7070',
        }}
        theme="light"
      >
        <div className="logo" style={{ padding: '22px', textAlign: 'center' }}>
          <img
            src={collapsed ? FrontifyNook : FrontifyLogo}
            alt="Frontify Logo"
            style={{ maxHeight: '32px' }}
          />
        </div>
        <Menu
          theme="light"
          selectedKeys={[menuKey]}
          defaultSelectedKeys={['upload-template']}
          mode="inline"
          onSelect={handleMenuSelect}
          className="custom-menu"
          inlineIndent={15}
        >
          <Menu.Item key="upload-template" icon={<CloudUploadOutlined />}>
            Check Template
          </Menu.Item>
          {checkerResults && (
            <Menu.Item key="results" icon={<FileDoneOutlined />}>
              Results
            </Menu.Item>
          )}
          <Menu.Item key="analytics" icon={<BarChartOutlined />}>
            Analytics
          </Menu.Item>
        </Menu>
        {user && (
          <div
            style={{
              position: 'absolute',
              bottom: 50,
              left: 0,
              right: 0,
              borderTop: '1px solid rgba(0,0,0,0.06)',
              padding: collapsed ? '12px 8px' : '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              backgroundColor: '#6C7070',
              flexWrap: 'nowrap',
            }}
          >
            {collapsed ? (
              <Dropdown
                menu={{ items: logoutMenuItems }}
                trigger={['click']}
                placement="topRight"
              >
                <span
                  style={{
                    cursor: 'pointer',
                    display: 'block',
                    lineHeight: 0,
                  }}
                >
                  <Avatar src={avatarUrl}>{avatarLetter}</Avatar>
                </span>
              </Dropdown>
            ) : (
              <>
                <Avatar src={avatarUrl} style={{ flexShrink: 0 }}>
                  {avatarLetter}
                </Avatar>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'rgba(0,0,0,0.85)',
                    fontSize: 14,
                  }}
                >
                  {displayName}
                </span>
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={() => signOut()}
                  style={{
                    color: 'rgba(0,0,0,0.65)',
                    padding: '0 4px',
                  }}
                >
                </Button>
              </>
            )}
          </div>
        )}
      </Sider>
    </div>
  );
}

export default SidebarMenu;
