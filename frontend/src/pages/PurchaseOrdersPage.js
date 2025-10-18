import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Plus, Pencil, Trash2, Eye, Link as LinkIcon, X, CheckCircle } from 'lucide-react';

export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [viewingPO, setViewingPO] = useState(null);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcilingPO, setReconcilingPO] = useState(null);

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/purchase-orders`);
      setPurchaseOrders(response.data);
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePO = async (data) => {
    try {
      await axios.post(`${API}/purchase-orders`, data);
      toast.success(t('purchaseOrders.poCreated'));
      fetchPurchaseOrders();
      setDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleUpdatePO = async (poId, data) => {
    try {
      await axios.put(`${API}/purchase-orders/${poId}`, data);
      toast.success(t('purchaseOrders.poUpdated'));
      fetchPurchaseOrders();
      setDialogOpen(false);
      setEditingPO(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleDeletePO = async (poId) => {
    if (!window.confirm('Are you sure you want to delete this purchase order?')) return;
    try {
      await axios.delete(`${API}/purchase-orders/${poId}`);
      toast.success(t('purchaseOrders.poDeleted'));
      fetchPurchaseOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleViewPO = async (poId) => {
    try {
      const response = await axios.get(`${API}/purchase-orders/${poId}`);
      setViewingPO(response.data);
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'));
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700',
      pending: 'bg-yellow-100 text-yellow-700',
      partially_paid: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {t(`purchaseOrders.${status}`)}
      </span>
    );
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
            {t('purchaseOrders.title')}
          </h1>
          <p className="text-slate-600">Manage purchase orders and reconcile with expenses, transactions, and checks</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingPO(null);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus size={16} className="mr-2" />
              {t('purchaseOrders.addPO')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPO ? t('purchaseOrders.editPO') : t('purchaseOrders.addPO')}</DialogTitle>
            </DialogHeader>
            <PurchaseOrderForm
              po={editingPO}
              onSubmit={(data) => editingPO ? handleUpdatePO(editingPO.id, data) : handleCreatePO(data)}
              onCancel={() => {
                setDialogOpen(false);
                setEditingPO(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('purchaseOrders.poNumber')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('purchaseOrders.supplier')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('purchaseOrders.dateCreated')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('purchaseOrders.total')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('purchaseOrders.amountPaid')}</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">{t('purchaseOrders.status')}</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{po.po_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{po.supplier}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{new Date(po.date_created).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">${po.total.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">${po.amount_paid?.toFixed(2) || '0.00'}</td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(po.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewPO(po.id)}>
                        <Eye size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReconcilingPO(po);
                          setReconcileDialogOpen(true);
                        }}
                      >
                        <LinkIcon size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPO(po);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePO(po.id)}
                        className="text-red-600 hover:text-red-700"
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

      {/* View PO Dialog */}
      <Dialog open={!!viewingPO} onOpenChange={(open) => !open && setViewingPO(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('purchaseOrders.viewPO')}</DialogTitle>
          </DialogHeader>
          {viewingPO && <PurchaseOrderDetails po={viewingPO} onClose={() => setViewingPO(null)} />}
        </DialogContent>
      </Dialog>

      {/* Reconciliation Dialog */}
      <Dialog open={reconcileDialogOpen} onOpenChange={setReconcileDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('purchaseOrders.reconciliation')} - {reconcilingPO?.po_number}</DialogTitle>
            <DialogDescription>
              Link expenses, transactions, or checks to this purchase order
            </DialogDescription>
          </DialogHeader>
          {reconcilingPO && (
            <ReconciliationPanel
              po={reconcilingPO}
              onUpdate={() => {
                fetchPurchaseOrders();
                setReconcileDialogOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form Component
function PurchaseOrderForm({ po, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    po_number: po?.po_number || '',
    supplier: po?.supplier || '',
    date_created: po?.date_created || new Date().toISOString().split('T')[0],
    date_expected: po?.date_expected || '',
    tax: po?.tax || 0,
    notes: po?.notes || '',
    payment_method: po?.payment_method || '',
    payment_check_id: po?.payment_check_id || '',
    items: po?.items || [{ id: Date.now().toString(), description: '', quantity: 1, unit_price: 0, total: 0 }],
  });
  const [availableChecks, setAvailableChecks] = useState([]);
  const [loadingChecks, setLoadingChecks] = useState(false);

  useEffect(() => {
    if (formData.payment_method === 'check') {
      fetchAvailableChecks();
    }
  }, [formData.payment_method]);

  const fetchAvailableChecks = async () => {
    try {
      setLoadingChecks(true);
      const response = await axios.get(`${API}/checks`);
      // Filter out checks already linked to POs (except if editing and it's this PO's check)
      const filtered = response.data.filter(check => 
        !check.purchase_order_id || check.id === po?.payment_check_id
      );
      setAvailableChecks(filtered);
    } catch (error) {
      console.error('Error fetching checks:', error);
    } finally {
      setLoadingChecks(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), description: '', quantity: 1, unit_price: 0, total: 0 }]
    });
  };

  const removeItem = (id) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.id !== id)
    });
  };

  const updateItem = (id, field, value) => {
    const updatedItems = formData.items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.total = parseFloat(updated.quantity || 0) * parseFloat(updated.unit_price || 0);
        }
        return updated;
      }
      return item;
    });
    setFormData({ ...formData, items: updatedItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const subtotal = calculateSubtotal();
  const total = subtotal + parseFloat(formData.tax || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="po_number">{t('purchaseOrders.poNumber')} *</Label>
          <Input
            id="po_number"
            value={formData.po_number}
            onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">{t('purchaseOrders.supplier')} *</Label>
          <Input
            id="supplier"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date_created">{t('purchaseOrders.dateCreated')} *</Label>
          <Input
            id="date_created"
            type="date"
            value={formData.date_created}
            onChange={(e) => setFormData({ ...formData, date_created: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_expected">{t('purchaseOrders.dateExpected')}</Label>
          <Input
            id="date_expected"
            type="date"
            value={formData.date_expected}
            onChange={(e) => setFormData({ ...formData, date_expected: e.target.value })}
          />
        </div>
      </div>

      {/* Payment Method Section */}
      <div className="border-t pt-4">
        <h3 className="text-base font-semibold mb-4">{t('purchaseOrders.paymentMethod')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="payment_method">{t('purchaseOrders.paymentMethod')}</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value, payment_check_id: '' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(None)</SelectItem>
                <SelectItem value="cash">{t('sales.cash')}</SelectItem>
                <SelectItem value="card">{t('sales.card')}</SelectItem>
                <SelectItem value="transfer">{t('sales.transfer')}</SelectItem>
                <SelectItem value="check">Check</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.payment_method === 'check' && (
            <div className="space-y-2">
              <Label htmlFor="payment_check_id">{t('purchaseOrders.paymentCheck')}</Label>
              {loadingChecks ? (
                <Input value="Loading checks..." readOnly disabled />
              ) : (
                <Select
                  value={formData.payment_check_id}
                  onValueChange={(value) => setFormData({ ...formData, payment_check_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('purchaseOrders.selectCheck')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChecks.map(check => (
                      <SelectItem key={check.id} value={check.id}>
                        Check #{check.check_number} - {check.payee} - ${check.amount.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {formData.payment_check_id && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ This check will be automatically linked to the PO upon creation
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-base font-semibold">{t('purchaseOrders.items')}</Label>
          <Button type="button" onClick={addItem} size="sm" variant="outline">
            <Plus size={14} className="mr-1" />
            {t('purchaseOrders.addItem')}
          </Button>
        </div>
        
        <div className="space-y-3">
          {formData.items.map((item, index) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-slate-50 rounded-lg">
              <div className="col-span-5">
                <Label className="text-xs">{t('purchaseOrders.description')}</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Item description"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('purchaseOrders.quantity')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('purchaseOrders.unitPrice')}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">{t('purchaseOrders.total')}</Label>
                <Input
                  type="number"
                  value={item.total.toFixed(2)}
                  readOnly
                  className="bg-slate-100"
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  disabled={formData.items.length === 1}
                  className="text-red-600"
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>{t('purchaseOrders.subtotal')}:</span>
          <span className="font-medium">${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span>{t('purchaseOrders.tax')}:</span>
          <Input
            type="number"
            step="0.01"
            value={formData.tax}
            onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
            className="w-32 h-8"
          />
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>{t('purchaseOrders.grandTotal')}:</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">{t('purchaseOrders.notes')}</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
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

// Details View Component
function PurchaseOrderDetails({ po, onClose }) {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-slate-600">{t('purchaseOrders.poNumber')}</p>
          <p className="font-semibold">{po.po_number}</p>
        </div>
        <div>
          <p className="text-sm text-slate-600">{t('purchaseOrders.supplier')}</p>
          <p className="font-semibold">{po.supplier}</p>
        </div>
        <div>
          <p className="text-sm text-slate-600">{t('purchaseOrders.dateCreated')}</p>
          <p>{new Date(po.date_created).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-sm text-slate-600">{t('purchaseOrders.status')}</p>
          <p>{t(`purchaseOrders.${po.status}`)}</p>
        </div>
      </div>

      {/* Items */}
      <div>
        <h3 className="font-semibold mb-3">{t('purchaseOrders.items')}</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left">{t('purchaseOrders.description')}</th>
                <th className="px-4 py-2 text-right">{t('purchaseOrders.quantity')}</th>
                <th className="px-4 py-2 text-right">{t('purchaseOrders.unitPrice')}</th>
                <th className="px-4 py-2 text-right">{t('purchaseOrders.total')}</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, idx) => (
                <tr key={idx} className="border-t">
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-right">{item.quantity}</td>
                  <td className="px-4 py-2 text-right">${item.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-medium">${item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span>{t('purchaseOrders.subtotal')}:</span>
          <span className="font-medium">${po.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t('purchaseOrders.tax')}:</span>
          <span className="font-medium">${po.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t pt-2">
          <span>{t('purchaseOrders.grandTotal')}:</span>
          <span>${po.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-blue-600">
          <span>{t('purchaseOrders.amountPaid')}:</span>
          <span className="font-medium">${po.amount_paid?.toFixed(2) || '0.00'}</span>
        </div>
        <div className="flex justify-between text-orange-600">
          <span>{t('purchaseOrders.balance')}:</span>
          <span className="font-medium">${(po.total - (po.amount_paid || 0)).toFixed(2)}</span>
        </div>
      </div>

      {/* Linked Items */}
      {po.linked_data && (
        <div className="space-y-4">
          {po.linked_data.expenses?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">{t('purchaseOrders.linkedExpenses')}</h4>
              <div className="space-y-1">
                {po.linked_data.expenses.map(exp => (
                  <div key={exp.id} className="flex justify-between text-sm p-2 bg-green-50 rounded">
                    <span>{exp.description || 'Expense'} - {new Date(exp.date).toLocaleDateString()}</span>
                    <span className="font-medium">${exp.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {po.linked_data.transactions?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">{t('purchaseOrders.linkedTransactions')}</h4>
              <div className="space-y-1">
                {po.linked_data.transactions.map(trans => (
                  <div key={trans.id} className="flex justify-between text-sm p-2 bg-blue-50 rounded">
                    <span>{trans.description || 'Transaction'} - {new Date(trans.date).toLocaleDateString()}</span>
                    <span className="font-medium">${trans.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {po.linked_data.checks?.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">{t('purchaseOrders.linkedChecks')}</h4>
              <div className="space-y-1">
                {po.linked_data.checks.map(check => (
                  <div key={check.id} className="flex justify-between text-sm p-2 bg-purple-50 rounded">
                    <span>Check #{check.check_number} - {check.payee}</span>
                    <span className="font-medium">${check.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {po.notes && (
        <div>
          <p className="text-sm text-slate-600 mb-1">{t('purchaseOrders.notes')}</p>
          <p className="text-sm bg-slate-50 p-3 rounded">{po.notes}</p>
        </div>
      )}
    </div>
  );
}

// Reconciliation Panel Component
function ReconciliationPanel({ po, onUpdate }) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableItems();
  }, []);

  const fetchAvailableItems = async () => {
    try {
      setLoading(true);
      const [expRes, transRes, checkRes] = await Promise.all([
        axios.get(`${API}/expenses`),
        axios.get(`${API}/bank-transactions`),
        axios.get(`${API}/checks`)
      ]);
      
      // Filter out already linked items
      setExpenses(expRes.data.filter(e => !e.purchase_order_id));
      setTransactions(transRes.data.filter(t => !t.purchase_order_id && t.validated));
      setChecks(checkRes.data.filter(c => !c.purchase_order_id));
    } catch (error) {
      toast.error(t('errors.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExpense = async (expenseId) => {
    try {
      await axios.post(`${API}/purchase-orders/${po.id}/link-expense`, {
        purchase_order_id: expenseId
      });
      toast.success(t('purchaseOrders.expenseLinked'));
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleLinkTransaction = async (transId) => {
    try {
      await axios.post(`${API}/purchase-orders/${po.id}/link-transaction`, {
        purchase_order_id: transId
      });
      toast.success(t('purchaseOrders.transactionLinked'));
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  const handleLinkCheck = async (checkId) => {
    try {
      await axios.post(`${API}/purchase-orders/${po.id}/link-check`, {
        purchase_order_id: checkId
      });
      toast.success(t('purchaseOrders.checkLinked'));
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errors.somethingWentWrong'));
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* PO Summary */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-600">Total</p>
            <p className="text-2xl font-bold">${po.total.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Paid</p>
            <p className="text-2xl font-bold text-blue-600">${(po.amount_paid || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Balance</p>
            <p className="text-2xl font-bold text-orange-600">${(po.total - (po.amount_paid || 0)).toFixed(2)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expenses">{t('purchaseOrders.linkExpense')}</TabsTrigger>
          <TabsTrigger value="transactions">{t('purchaseOrders.linkTransaction')}</TabsTrigger>
          <TabsTrigger value="checks">{t('purchaseOrders.linkCheck')}</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-2 mt-4">
          <h4 className="text-sm font-semibold">{t('purchaseOrders.availableExpenses')}</h4>
          {expenses.length === 0 ? (
            <p className="text-sm text-slate-500">No available expenses</p>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                <div>
                  <p className="font-medium">{exp.description || 'Expense'}</p>
                  <p className="text-sm text-slate-600">{new Date(exp.date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">${exp.amount.toFixed(2)}</span>
                  <Button size="sm" onClick={() => handleLinkExpense(exp.id)}>
                    <LinkIcon size={14} className="mr-1" />
                    Link
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-2 mt-4">
          <h4 className="text-sm font-semibold">{t('purchaseOrders.availableTransactions')}</h4>
          {transactions.length === 0 ? (
            <p className="text-sm text-slate-500">No available transactions</p>
          ) : (
            transactions.map(trans => (
              <div key={trans.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                <div>
                  <p className="font-medium">{trans.description || 'Transaction'}</p>
                  <p className="text-sm text-slate-600">{new Date(trans.date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">${trans.amount.toFixed(2)}</span>
                  <Button size="sm" onClick={() => handleLinkTransaction(trans.id)}>
                    <LinkIcon size={14} className="mr-1" />
                    Link
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="checks" className="space-y-2 mt-4">
          <h4 className="text-sm font-semibold">{t('purchaseOrders.availableChecks')}</h4>
          {checks.length === 0 ? (
            <p className="text-sm text-slate-500">No available checks</p>
          ) : (
            checks.map(check => (
              <div key={check.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50">
                <div>
                  <p className="font-medium">Check #{check.check_number} - {check.payee}</p>
                  <p className="text-sm text-slate-600">{new Date(check.date_issued).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">${check.amount.toFixed(2)}</span>
                  <Button size="sm" onClick={() => handleLinkCheck(check.id)}>
                    <LinkIcon size={14} className="mr-1" />
                    Link
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
