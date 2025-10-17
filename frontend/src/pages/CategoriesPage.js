import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'income',
    is_cogs: false
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/categories`);
      setCategories(response.data);
    } catch (error) {
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await axios.put(`${API}/categories/${editingCategory.id}`, formData);
        toast.success('Categoría actualizada');
      } else {
        await axios.post(`${API}/categories`, formData);
        toast.success('Categoría creada');
      }
      setDialogOpen(false);
      setEditingCategory(null);
      setFormData({ name: '', type: 'income', is_cogs: false });
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar categoría');
    }
  };

  const handleDelete = async (category) => {
    if (category.is_predefined) {
      toast.error('No se pueden eliminar categorías predefinidas');
      return;
    }
    if (window.confirm('¿Eliminar esta categoría?')) {
      try {
        await axios.delete(`${API}/categories/${category.id}`);
        toast.success('Categoría eliminada');
        fetchCategories();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Error al eliminar categoría');
      }
    }
  };

  const handleEdit = (category) => {
    if (category.is_predefined) {
      toast.error('No se pueden editar categorías predefinidas');
      return;
    }
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      is_cogs: category.is_cogs || false
    });
    setDialogOpen(true);
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="categories-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Categorías
          </h1>
          <p className="text-slate-600">Organiza tus ingresos y gastos por categorías</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-category-button">
              <Plus size={16} className="mr-2" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                  data-testid="category-name-input"
                  placeholder="Ej: Comida, Transporte"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                  <SelectTrigger data-testid="category-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Ingreso</SelectItem>
                    <SelectItem value="expense">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" data-testid="category-submit-button">
                {editingCategory ? 'Actualizar' : 'Crear'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Categories */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <TrendingUp className="text-emerald-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Categorías de Ingresos
              </h2>
              <p className="text-sm text-slate-600">{incomeCategories.length} categorías</p>
            </div>
          </div>
          <div className="space-y-2">
            {incomeCategories.map(category => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-slate-900 font-medium">{category.name}</span>
                  {category.is_predefined && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      Predefinida
                    </span>
                  )}
                </div>
                {!category.is_predefined && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`edit-category-${category.id}`}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`delete-category-${category.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {incomeCategories.length === 0 && (
              <p className="text-center py-8 text-slate-500">No hay categorías de ingresos</p>
            )}
          </div>
        </div>

        {/* Expense Categories */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-red-50 rounded-lg">
              <TrendingDown className="text-red-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Categorías de Gastos
              </h2>
              <p className="text-sm text-slate-600">{expenseCategories.length} categorías</p>
            </div>
          </div>
          <div className="space-y-2">
            {expenseCategories.map(category => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-slate-900 font-medium">{category.name}</span>
                  {category.is_predefined && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      Predefinida
                    </span>
                  )}
                </div>
                {!category.is_predefined && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`edit-category-${category.id}`}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`delete-category-${category.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {expenseCategories.length === 0 && (
              <p className="text-center py-8 text-slate-500">No hay categorías de gastos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}