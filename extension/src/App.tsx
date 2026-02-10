import React, { useState } from 'react';
import { Layout, ConfigProvider, Spin } from 'antd';
import FileUploadPage from './components/File Upload/FileUpload';
import ValidationList from './components/Validation List/ValidationList';
import Analytics from './components/Analytics/Analytics';
import SidebarMenu from './components/SidebarMenu';
import Login from './components/Login/Login';
import { useMenu } from './components/MenuContext';
import { useAuth } from './components/AuthContext';
import { ValidationResult } from './types';
import './App.css';

const { Content } = Layout;

export default function App() {
  const [checkerResults, setCheckerResults] = useState<ValidationResult | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { menuKey } = useMenu();
  const { hasToken, loading } = useAuth();

  const checkerResponse = (jsonResponse: ValidationResult) => {
    setCheckerResults(jsonResponse);
  };

  const componentsSwitch = (key: string) => {
    switch (key) {
      case 'upload-template':
        return <FileUploadPage checkerResponse={checkerResponse} />;
      case 'results':
        return checkerResults ? <ValidationList jsonResponse={checkerResults} checkerResponse={checkerResponse} /> : null;
      case 'analytics':
        return <Analytics />;
      default:
        return <div>Uh oh, something went wrong.</div>;
    }
  };

  if (loading) {
    return (
      <ConfigProvider theme={{ token: { fontFamily: 'Space Grotesk Frontify', colorPrimary: '#B39DFD' } }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #16213e 100%)' }}>
          <Spin size="large" />
        </div>
      </ConfigProvider>
    );
  }

  if (!hasToken) {
    return <Login />;
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: 'Space Grotesk Frontify',
          colorPrimary: '#B39DFD',
          colorLink: '#9A7EFE'
        },
      }}
    >
      <div className="app-background">
        <Layout style={{ minHeight: '600px', height: '100vh', overflow: 'auto' }}>
          <SidebarMenu
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            checkerResults={checkerResults}
          />
          <Content style={{ flex: 1, marginLeft: collapsed ? 80 : 200, }}>
            <div style={{ minHeight: '600px', width: '100%', display: 'flex', alignItems: (menuKey === 'results' || menuKey === 'analytics') ? 'flex-start' : 'center', justifyContent: 'center' }}>
              {componentsSwitch(menuKey)}
            </div>
          </Content>
        </Layout>
      </div>
    </ConfigProvider>
  );
}
