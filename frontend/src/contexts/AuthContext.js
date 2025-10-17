import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        
        // Set language from user preferences
        if (parsedUser.language) {
          i18n.changeLanguage(parsedUser.language);
        }
        
        // Fetch user permissions
        await fetchPermissions();
      }
      setLoading(false);
    };
    
    initAuth();
  }, [i18n]);

  const fetchPermissions = async () => {
    try {
      const response = await axios.get(`${API}/profile/permissions`);
      setPermissions(response.data.permissions || []);
      
      // Update localStorage with latest user data including role and language
      const updatedUser = {
        id: response.data.user_id,
        username: response.data.username,
        email: response.data.email,
        role: response.data.role,
        language: response.data.language
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // If error fetching permissions, set default permissions for backward compatibility
      setPermissions([]);
    }
  };

  const login = async (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    
    // Set language
    if (userData.language) {
      i18n.changeLanguage(userData.language);
    }
    
    // Fetch permissions
    await fetchPermissions();
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions([]);
  };

  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(permission => permissions.includes(permission));
  };

  const hasRole = (role) => {
    return user?.role === role;
  };

  const updateLanguage = async (language) => {
    try {
      await axios.put(`${API}/profile/language?language=${language}`);
      const updatedUser = { ...user, language };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      i18n.changeLanguage(language);
    } catch (error) {
      console.error('Error updating language:', error);
      throw error;
    }
  };

  const value = {
    user,
    permissions,
    loading,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasRole,
    updateLanguage,
    fetchPermissions
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
