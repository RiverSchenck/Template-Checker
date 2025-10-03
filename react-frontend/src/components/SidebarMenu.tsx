// eslint-disable-next-line import/named
import { Layout, Menu } from 'antd';
import {
  CloudUploadOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { ValidationResult } from '../types';
import FrontifyLogo from '../assets/frontifyLogo.svg';
import FrontifyNook from '../assets/frontifyNook.svg';
import { useMenu } from './MenuContext';
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
        </Menu>
      </Sider>
    </div>
  );
}

export default SidebarMenu;
