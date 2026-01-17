import React, { useState, useEffect } from 'react';
import { Layout, ConfigProvider } from 'antd';
import FileUploadPage from './components/File Upload/FileUpload';
import ValidationList from './components/Validation List/ValidationList'
import SidebarMenu from './components/SidebarMenu';
import Analytics from './components/Analytics/Analytics';
import { useMenu } from './components/MenuContext';
import { ValidationResult } from './types';
import './App.css';

const { Content } = Layout;

export default function App() {
  const [checkerResults, setCheckerResults] = useState<ValidationResult | null>(null);
  const [seeDetails, setSeeDetails] = useState<Boolean>(false);
  const [previousCheckerResults, setPreviousCheckerResults] = useState<ValidationResult | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { menuKey } = useMenu();

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
