import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SetPasswordPage from './pages/SetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import ExpensesPage from './pages/ExpensesPage';
import CategoriesPage from './pages/CategoriesPage';
import ReportsPage from './pages/ReportsPage';
import BankReconciliationPage from './pages/BankReconciliationPage';
import UsersPage from './pages/UsersPage';
import Layout from './components/Layout';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Axios interceptor to add auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" /> : <RegisterPage />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={
            <ProtectedRoute requiredPermission="view_dashboard">
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="sales" element={
            <ProtectedRoute requiredPermission="view_sales">
              <SalesPage />
            </ProtectedRoute>
          } />
          <Route path="expenses" element={
            <ProtectedRoute requiredPermission="view_expenses">
              <ExpensesPage />
            </ProtectedRoute>
          } />
          <Route path="categories" element={
            <ProtectedRoute requiredPermission="view_categories">
              <CategoriesPage />
            </ProtectedRoute>
          } />
          <Route path="reports" element={
            <ProtectedRoute requiredPermission="view_reports">
              <ReportsPage />
            </ProtectedRoute>
          } />
          <Route path="bank-reconciliation" element={
            <ProtectedRoute requiredPermission="view_bank_reconciliation">
              <BankReconciliationPage />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute requiredPermission="manage_users">
              <UsersPage />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Toaster position="top-right" />
        <AppRoutes />
      </div>
    </AuthProvider>
  );
}

export default App;