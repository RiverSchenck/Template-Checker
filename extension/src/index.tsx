import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import Fonts from './styles/fonts';
import App from './App';
import { MenuProvider } from './components/MenuContext';
import { AuthProvider } from './components/AuthContext';

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
