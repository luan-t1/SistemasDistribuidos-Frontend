import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import { UserProvider } from './contexts/UserContext';

const App: React.FC = () => {
  return (
    <UserProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </UserProvider>
  );
};

export default App;
