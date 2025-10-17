import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { Pencil, Trash2, UserPlus, Copy, CheckCircle, Clock, Shield } from 'lucide-react';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState(null);
  const [activationLink, setActivationLink] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, permsRes, rolesRes] = await Promise.all([
        axios.get(`${API}/users`),
        axios.get(`${API}/permissions`),
        axios.get(`${API}/roles`)
      ]);
      setUsers(usersRes.data);
      setAvailablePermissions(permsRes.data.permissions || []);
      setRoles(rolesRes.data.roles || []);
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
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleUpdateUser = async (userId, data) => {
    try {
      await axios.put(`${API}/users/${userId}`, data);
      toast.success(t('users.userUpdated'));
      fetchData();
      setEditDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`${API}/users/${userId}`);
      toast.success(t('users.userDeleted'));
      fetchData();
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
      case 'admin': return t('users.admin');
      case 'manager': return t('users.manager');
      case 'accountant': return t('users.accountant');
      case 'seller': return t('users.seller');
      default: return role;
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

  const viewUserPermissions = (user) => {
    setSelectedUserPermissions(user);
    setPermissionsDialogOpen(true);
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
              <DialogDescription>
                Create a new user account with specific role and permissions.
              </DialogDescription>
            </DialogHeader>
            {activationLink ? (
              <ActivationLinkDisplay link={activationLink} onCopy={copyToClipboard} onClose={() => {
                setInviteDialogOpen(false);
                setActivationLink(null);
              }} />
            ) : (
              <UserInviteForm 
                onSubmit={handleInviteUser} 
                availablePermissions={availablePermissions}
                roles={roles}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Permissions Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="permissions" className="border-none">
            <AccordionTrigger className="text-sm font-medium text-blue-900 hover:no-underline">
              <div className="flex items-center gap-2">
                <Shield size={16} />
                View Default Permissions by Role
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {roles.map(role => (
                  <div key={role.value} className="bg-white rounded-lg p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-900 mb-2">{getRoleName(role.value)}</h3>
                    <p className="text-xs text-slate-600 mb-3">{role.permissions.length} permissions</p>
                    <div className="space-y-1 text-xs text-slate-700">
                      {role.permissions.slice(0, 5).map(perm => (
                        <div key={perm} className="flex items-start gap-1">
                          <CheckCircle size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="break-words">{t(`permissions.${perm}`)}</span>
                        </div>
                      ))}
                      {role.permissions.length > 5 && (
                        <p className="text-slate-500 italic">+{role.permissions.length - 5} more...</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Permissions</th>
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
                  <td className="px-6 py-4 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewUserPermissions(user)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Shield size={14} className="mr-1" />
                      {user.custom_permissions ? 'Custom' : 'Default'} ({user.permissions?.length || 0})
                    </Button>
                  </td>
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
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{t('users.editUser')}</DialogTitle>
                            <DialogDescription>
                              Update user role and customize permissions
                            </DialogDescription>
                          </DialogHeader>
                          <UserEditForm
                            user={user}
                            availablePermissions={availablePermissions}
                            roles={roles}
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

      {/* Permissions View Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Permissions</DialogTitle>
            <DialogDescription>
              {selectedUserPermissions?.username} ({selectedUserPermissions?.email})
            </DialogDescription>
          </DialogHeader>
          {selectedUserPermissions && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-medium text-slate-900 mb-2">
                  Role: <span className="text-emerald-600">{getRoleName(selectedUserPermissions.role)}</span>
                </p>
                <p className="text-sm text-slate-600">
                  {selectedUserPermissions.custom_permissions ? (
                    <span className="text-orange-600 font-medium">✨ Using custom permissions</span>
                  ) : (
                    <span>Using default role permissions</span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                {selectedUserPermissions.permissions?.map(perm => (
                  <div key={perm} className="flex items-start gap-2 p-2 bg-emerald-50 rounded border border-emerald-200">
                    <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-slate-700">{t(`permissions.${perm}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserInviteForm({ onSubmit, availablePermissions, roles }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'seller',
    language: 'en',
  });
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const currentRolePermissions = roles.find(r => r.value === formData.role)?.permissions || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const submitData = {
      ...formData,
      custom_permissions: useCustomPermissions ? selectedPermissions : null
    };
    await onSubmit(submitData);
    setSubmitting(false);
  };

  const togglePermission = (perm) => {
    setSelectedPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">{t('users.role')}</Label>
          <Select
            value={formData.role}
            onValueChange={(value) => {
              setFormData({ ...formData, role: value });
              setUseCustomPermissions(false);
              setSelectedPermissions([]);
            }}
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
      </div>

      {/* Custom Permissions Section */}
      <div className="border-t pt-4">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox 
            id="customPerms" 
            checked={useCustomPermissions}
            onCheckedChange={setUseCustomPermissions}
          />
          <Label htmlFor="customPerms" className="cursor-pointer">
            Customize permissions (override default role permissions)
          </Label>
        </div>

        {useCustomPermissions ? (
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                ⚠️ Custom permissions will override the default {formData.role} role permissions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
              {availablePermissions.map(perm => (
                <div key={perm.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={perm.value}
                    checked={selectedPermissions.includes(perm.value)}
                    onCheckedChange={() => togglePermission(perm.value)}
                  />
                  <Label htmlFor={perm.value} className="text-xs cursor-pointer leading-tight">
                    {t(`permissions.${perm.value}`)}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              {selectedPermissions.length} permission(s) selected
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-3 border">
            <p className="text-xs text-slate-600 mb-2">
              Default permissions for <span className="font-semibold">{formData.role}</span> role:
            </p>
            <div className="grid grid-cols-2 gap-1">
              {currentRolePermissions.map(perm => (
                <div key={perm} className="flex items-start gap-1 text-xs text-slate-700">
                  <CheckCircle size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>{t(`permissions.${perm}`)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
          {submitting ? 'Creating...' : 'Create User & Generate Link'}
        </Button>
      </div>
    </form>
  );
}

function UserEditForm({ user, availablePermissions, roles, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: user.username,
    role: user.role,
    language: user.language || 'en',
  });
  const [useCustomPermissions, setUseCustomPermissions] = useState(!!user.custom_permissions);
  const [selectedPermissions, setSelectedPermissions] = useState(user.custom_permissions || []);

  const currentRolePermissions = roles.find(r => r.value === formData.role)?.permissions || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      custom_permissions: useCustomPermissions ? selectedPermissions : null
    };
    onSubmit(submitData);
  };

  const togglePermission = (perm) => {
    setSelectedPermissions(prev => 
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
            onValueChange={(value) => {
              setFormData({ ...formData, role: value });
              if (!useCustomPermissions) {
                setSelectedPermissions([]);
              }
            }}
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

      {/* Custom Permissions Section */}
      <div className="border-t pt-4">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox 
            id="customPermsEdit" 
            checked={useCustomPermissions}
            onCheckedChange={(checked) => {
              setUseCustomPermissions(checked);
              if (!checked) {
                setSelectedPermissions([]);
              }
            }}
          />
          <Label htmlFor="customPermsEdit" className="cursor-pointer">
            Customize permissions
          </Label>
        </div>

        {useCustomPermissions ? (
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                ⚠️ Custom permissions will override the default {formData.role} role permissions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 bg-slate-50 rounded-lg border">
              {availablePermissions.map(perm => (
                <div key={perm.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`edit-${perm.value}`}
                    checked={selectedPermissions.includes(perm.value)}
                    onCheckedChange={() => togglePermission(perm.value)}
                  />
                  <Label htmlFor={`edit-${perm.value}`} className="text-xs cursor-pointer leading-tight">
                    {t(`permissions.${perm.value}`)}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              {selectedPermissions.length} permission(s) selected
            </p>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-3 border">
            <p className="text-xs text-slate-600 mb-2">
              Using default permissions for <span className="font-semibold">{formData.role}</span> role:
            </p>
            <div className="grid grid-cols-2 gap-1">
              {currentRolePermissions.map(perm => (
                <div key={perm} className="flex items-start gap-1 text-xs text-slate-700">
                  <CheckCircle size={12} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>{t(`permissions.${perm}`)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
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
