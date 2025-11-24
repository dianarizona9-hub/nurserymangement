import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUsername = await AsyncStorage.getItem('username');
      if (storedToken && storedUsername) {
        setToken(storedToken);
        setUsername(storedUsername);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error loading token:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        username,
        password,
      });
      const { access_token, username: user } = response.data;
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('username', user);
      setToken(access_token);
      setUsername(user);
      setIsAuthenticated(true);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const register = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        username,
        password,
      });
      const { access_token, username: user } = response.data;
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('username', user);
      setToken(access_token);
      setUsername(user);
      setIsAuthenticated(true);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('username');
    setToken(null);
    setUsername(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
