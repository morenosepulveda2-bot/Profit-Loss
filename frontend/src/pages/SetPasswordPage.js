import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { CheckCircle, XCircle } from 'lucide-react';

export default function SetPasswordPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      validateToken(tokenParam);
    } else {
      setValidating(false);
      toast.error('No activation token provided');
    }
  }, [searchParams]);

  const validateToken = async (tokenValue) => {
    try {
      setValidating(true);
      const response = await axios.get(`${API}/auth/validate-token/${tokenValue}`);
      if (response.data.valid) {
        setTokenValid(true);
        setUserInfo(response.data);
      }
    } catch (error) {
      setTokenValid(false);
      toast.error(error.response?.data?.detail || 'Invalid or expired activation token');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/set-password`, {
        token,
        password,
      });

      const { access_token, user } = response.data;
      await login(access_token, user);
      toast.success('Password set successfully! Welcome!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error setting password');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Validating activation link...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Activation Link</h1>
            <p className="text-slate-600 mb-6">
              This activation link is invalid or has expired. Please contact your administrator for a new invitation.
            </p>
            <Button
              onClick={() => navigate('/login')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="text-center mb-8">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Set Your Password
            </h1>
            <p className="text-slate-600">
              Welcome, <span className="font-semibold">{userInfo?.username}</span>!
            </p>
            <p className="text-sm text-slate-500 mt-1">{userInfo?.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
                className="w-full"
              />
              <p className="text-xs text-slate-500">Minimum 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                minLength={6}
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Setting Password...' : 'Set Password & Login'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> After setting your password, you'll be automatically logged in to your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
