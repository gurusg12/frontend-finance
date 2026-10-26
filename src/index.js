import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider }  from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App/>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
