import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import Fonts from './styles/fonts';
import App from './App';
import { AuthProvider } from './components/AuthContext';
import { MenuProvider } from './components/MenuContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
    <React.StrictMode>
      <Fonts />
      <AuthProvider>
        <MenuProvider>
          <App />
        </MenuProvider>
      </AuthProvider>
    </React.StrictMode>
);
