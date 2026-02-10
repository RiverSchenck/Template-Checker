// eslint-disable-next-line import/named
import { Layout, Menu, Avatar, Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  CloudUploadOutlined,
  FileDoneOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.email || '';
  const avatarLetter = (displayName || '?').charAt(0).toUpperCase();

  const logoutMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Log out',
      onClick: () => logout(),
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
        trigger={null}
        style={{
          height: '100vh',
          position: 'fixed',
          left: 0,
          backgroundColor: '#6C7070',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        theme="light"
      >
        <div className="logo" style={{ padding: '22px', textAlign: 'center', flexShrink: 0 }}>
          <img
            src={collapsed ? FrontifyNook : FrontifyLogo}
            alt="Frontify Logo"
            style={{ maxHeight: '32px' }}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
        </div>
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid rgba(0,0,0,0.1)',
            padding: collapsed ? '10px 8px' : '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#5a5e5e',
            minHeight: 52,
          }}
        >
          {user ? (
            collapsed ? (
              <>
                <Dropdown menu={{ items: logoutMenuItems }} trigger={['click']} placement="topRight">
                  <span style={{ cursor: 'pointer', lineHeight: 0 }}>
                    <Avatar src={user?.avatarUrl}>{avatarLetter}</Avatar>
                  </span>
                </Dropdown>
                <Button
                  type="text"
                  size="small"
                  icon={<MenuUnfoldOutlined />}
                  onClick={() => setCollapsed(false)}
                  style={{ color: 'rgba(255,255,255,0.85)', marginLeft: 'auto' }}
                  title="Expand sidebar"
                />
              </>
            ) : (
              <>
                <Avatar src={user?.avatarUrl} style={{ flexShrink: 0 }}>
                  {avatarLetter}
                </Avatar>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: 13,
                  }}
                >
                  {displayName}
                </span>
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={() => logout()}
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                  title="Log out"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined />}
                  onClick={() => setCollapsed(true)}
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                  title="Collapse sidebar"
                />
              </>
            )
          ) : (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ color: 'rgba(255,255,255,0.85)', marginLeft: 'auto' }}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            />
          )}
        </div>
      </Sider>
    </div>
  );
}

export default SidebarMenu;
