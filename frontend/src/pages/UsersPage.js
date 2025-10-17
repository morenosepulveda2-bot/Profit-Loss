import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Pencil, Trash2, UserPlus, Copy, CheckCircle, Clock } from 'lucide-react';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [activationLink, setActivationLink] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (userData) => {
    try {
      const response = await axios.post(`${API}/users/invite`, userData);
      toast.success(t('users.userAdded'));
      setActivationLink(response.data.activation_link);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await axios.put(`${API}/users/${userId}`, data);
      toast.success(t('users.userUpdated'));
      fetchUsers();
      setEditDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success(t('users.userDeleted'));
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Activation link copied to clipboard!');
  };

  const getRoleName = (role) => {
    switch (role) {
      case 'admin':
        return t('users.admin');
      case 'manager':
        return t('users.manager');
      case 'accountant':
        return t('users.accountant');
      case 'seller':
        return t('users.seller');
      default:
        return role;
    }
  };

  const getStatusBadge = (user) => {
    if (user.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle size={12} />
          Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <Clock size={12} />
          Pending
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {t('users.title')}
          </h1>
          <p className="text-slate-600">Manage user roles and permissions</p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) setActivationLink(null);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <UserPlus size={16} className="mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Create a new user account. They will receive an activation link to set their password.
              </DialogDescription>
            </DialogHeader>
            {activationLink ? (
              <ActivationLinkDisplay link={activationLink} onCopy={copyToClipboard} onClose={() => {
                setInviteDialogOpen(false);
                setActivationLink(null);
              }} />
            ) : (
              <UserInviteForm onSubmit={handleInviteUser} />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('users.username')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('users.email')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('users.role')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('users.language')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900">{user.username}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      {getRoleName(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(user)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 uppercase">{user.language || 'en'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog open={editDialogOpen && editingUser?.id === user.id} onOpenChange={(open) => {
                        setEditDialogOpen(open);
                        if (!open) setEditingUser(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(user)}
                          >
                            <Pencil size={16} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{t('users.editUser')}</DialogTitle>
                            <DialogDescription>
                              Update user role and permissions
                            </DialogDescription>
                          </DialogHeader>
                          <UserEditForm
                            user={user}
                            onSubmit={(data) => handleUpdateUser(user.id, data)}
                            onCancel={() => {
                              setEditDialogOpen(false);
                              setEditingUser(null);
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserInviteForm({ onSubmit }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'seller',
    language: 'en',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(formData);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">{t('users.username')}</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="Enter full name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t('users.email')}</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="user@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">{t('users.role')}</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('users.selectRole')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">{t('users.admin')}</SelectItem>
            <SelectItem value="manager">{t('users.manager')}</SelectItem>
            <SelectItem value="accountant">{t('users.accountant')}</SelectItem>
            <SelectItem value="seller">{t('users.seller')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">{t('users.language')}</Label>
        <Select
          value={formData.language}
          onValueChange={(value) => setFormData({ ...formData, language: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
          {submitting ? 'Creating...' : 'Create User & Generate Link'}
        </Button>
      </div>
    </form>
  );
}

function ActivationLinkDisplay({ link, onCopy, onClose }) {
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <p className="text-sm font-medium text-emerald-900 mb-2">✅ User invited successfully!</p>
        <p className="text-sm text-emerald-700">Share this activation link with the user to set their password:</p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <Label className="text-xs text-slate-600 mb-2 block">Activation Link (valid for 7 days):</Label>
        <div className="flex gap-2">
          <Input
            value={link}
            readOnly
            className="flex-1 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => onCopy(link)}
          >
            <Copy size={16} />
          </Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Important:</strong> The user must use this link to set their password before they can log in. The link will expire in 7 days.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700">
          Done
        </Button>
      </div>
    </div>
  );
}

function UserEditForm({ user, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: user.username,
    role: user.role,
    language: user.language || 'en',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">{t('users.username')}</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">{t('users.role')}</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('users.selectRole')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">{t('users.admin')}</SelectItem>
            <SelectItem value="manager">{t('users.manager')}</SelectItem>
            <SelectItem value="accountant">{t('users.accountant')}</SelectItem>
            <SelectItem value="seller">{t('users.seller')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">{t('users.language')}</Label>
        <Select
          value={formData.language}
          onValueChange={(value) => setFormData({ ...formData, language: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
