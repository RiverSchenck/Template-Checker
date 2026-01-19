import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout, ConfigProvider } from 'antd';
import FileUploadPage from './components/File Upload/FileUpload';
import ValidationList from './components/Validation List/ValidationList'
import SidebarMenu from './components/SidebarMenu';
import Analytics from './components/Analytics/Analytics';
import Login from './components/Login/Login';
import AuthCallback from './components/AuthCallback';
import { useMenu } from './components/MenuContext';
import { useAuth } from './components/AuthContext';
import { ValidationResult } from './types';
import './App.css';

const { Content } = Layout;

function AppContent() {
  const [checkerResults, setCheckerResults] = useState<ValidationResult | null>(null);
  const [seeDetails, setSeeDetails] = useState<Boolean>(false);
  const [previousCheckerResults, setPreviousCheckerResults] = useState<ValidationResult | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { menuKey } = useMenu();
  const { user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  const checkerResponse = (jsonResponse: ValidationResult, setPrevious: boolean = false) => {
    if (setPrevious && checkerResults) {
      setPreviousCheckerResults(checkerResults);
    }
    else{
      setPreviousCheckerResults(null)
    }
    setSeeDetails(false)
    setCheckerResults(jsonResponse);
  };

  const handleSeeDetails = (value: Boolean) => {
    setSeeDetails(value);
  }


  const componentsSwitch = (key: string) => {
    console.log('componentswitch', key)
    switch (key) {
      case 'upload-template':
        return <FileUploadPage checkerResponse={checkerResponse} seeDetails={handleSeeDetails}/>;
      case 'results':
        return checkerResults ? <ValidationList jsonResponse={checkerResults} checkerResponse={checkerResponse} previousJsonResponse={previousCheckerResults || null} seeDetails={seeDetails}/> : null;
      case 'analytics':
        return <Analytics />;
      default:
        return <div>Uh oh, something went wrong.</div>;
     }
  };

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
          <Layout style={{ minHeight: '100vh' }}>
          <SidebarMenu
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            checkerResults={checkerResults}
          />
            <Content style={{ flex: 1, marginLeft: collapsed ? 80 : 200, overflow: 'auto' }}>
              <div style={{
                height: menuKey === 'analytics' ? 'auto' : '100vh',
                width: '100%',
                display: 'flex',
                alignItems: menuKey === 'analytics' ? 'flex-start' : 'center',
                justifyContent: 'center'
              }}>
                {componentsSwitch(menuKey)}
              </div>
            </Content>
          </Layout>
        </div>
        </ConfigProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/*" element={<AppContent />} />
      </Routes>
    </BrowserRouter>
  );
}
