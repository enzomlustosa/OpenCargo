import React, { createContext, useContext, useState } from 'react';
import { loginWithCode } from '../services/api';

const AuthContext = createContext(null);
const SESSION_STORAGE_KEY = 'opencargo_session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Envia o código ao ESP32 (POST /api/login) e armazena apenas o retorno validado pelo backend
  async function login(code) {
    const trimmedCode = String(code || '').trim();
    const response = await loginWithCode(trimmedCode);

    const newSession = {
      code: trimmedCode,
      user: response.user,
    };

    setSession(newSession);
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    return newSession;
  }

  function logout() {
    setSession(null);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        accessCode: session?.code || '',
        isAuthenticated: Boolean(session?.user),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.');
  }
  return context;
}
