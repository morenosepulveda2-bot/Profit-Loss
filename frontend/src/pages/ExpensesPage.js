import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import FilterPanel from '../components/FilterPanel';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    category_id: '',
    min_amount: '',
    max_amount: '',
    description: ''
  });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category_id: '',
    description: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data.filter(c => c.type === 'expense'));
    } catch (error) {
      toast.error('Error loading categories');
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params.append(key, value);
        }
      });

      const response = await axios.get(`${API}/expenses?${params.toString()}`);
      setExpenses(response.data);
    } catch (error) {
      toast.error('Error loading expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      date_from: '',
      date_to: '',
      category_id: '',
      min_amount: '',
      max_amount: '',
      description: ''
    });
  };

  const fetchData = async () => {
    await fetchCategories();
    await fetchExpenses();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await axios.put(`${API}/expenses/${editingExpense.id}`, formData);
        toast.success('Gasto actualizado');
      } else {
        await axios.post(`${API}/expenses`, formData);
        toast.success('Gasto creado');
      }
      setDialogOpen(false);
      setEditingExpense(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        category_id: '',
        description: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Error al guardar gasto');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este gasto?')) {
      try {
        await axios.delete(`${API}/expenses/${id}`);
        toast.success('Gasto eliminado');
        fetchData();
      } catch (error) {
        toast.error('Error al eliminar gasto');
      }
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      amount: expense.amount.toString(),
      category_id: expense.category_id,
      description: expense.description || ''
    });
    setDialogOpen(true);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Desconocida';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="expenses-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Gastos
          </h1>
          <p className="text-slate-600">Registra y controla todos tus gastos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-expense-button">
              <Plus size={16} className="mr-2" />
              Nuevo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  required
                  data-testid="expense-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                  data-testid="expense-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={formData.category_id} onValueChange={(value) => setFormData({...formData, category_id: value})}>
                  <SelectTrigger data-testid="expense-category-select">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  data-testid="expense-description-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="expense-submit-button">
                {editingExpense ? 'Actualizar' : 'Crear'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>



      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        categories={categories}
        showPaymentMethod={false}
        showSource={false}
      />

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="expenses-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Fecha</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Monto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Categoría</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Descripción</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {expenses.map(expense => (
                <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900">{expense.date}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-red-600">${expense.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{getCategoryName(expense.category_id)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{expense.description || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        data-testid={`edit-expense-${expense.id}`}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        data-testid={`delete-expense-${expense.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No hay gastos registrados. Crea tu primer gasto.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}