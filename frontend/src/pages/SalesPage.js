import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Plus, Upload, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import Papa from 'papaparse';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category_id: '',
    payment_method: 'Efectivo',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [salesRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/sales`),
        axios.get(`${API}/categories`)
      ]);
      setSales(salesRes.data);
      setCategories(categoriesRes.data.filter(c => c.type === 'income'));
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSale) {
        await axios.put(`${API}/sales/${editingSale.id}`, formData);
        toast.success('Venta actualizada');
      } else {
        await axios.post(`${API}/sales`, formData);
        toast.success('Venta creada');
      }
      setDialogOpen(false);
      setEditingSale(null);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        category_id: '',
        payment_method: 'Efectivo',
        description: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Error al guardar venta');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar esta venta?')) {
      try {
        await axios.delete(`${API}/sales/${id}`);
        toast.success('Venta eliminada');
        fetchData();
      } catch (error) {
        toast.error('Error al eliminar venta');
      }
    }
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setFormData({
      date: sale.date,
      amount: sale.amount.toString(),
      category_id: sale.category_id,
      payment_method: sale.payment_method,
      description: sale.description || ''
    });
    setDialogOpen(true);
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          await axios.post(`${API}/sales/import-csv`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('CSV importado exitosamente');
          fetchData();
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Error al importar CSV');
        }
      },
      error: (error) => {
        toast.error('Error al leer el archivo CSV');
      }
    });

    event.target.value = '';
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
    <div className="space-y-8" data-testid="sales-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Ventas e Ingresos
          </h1>
          <p className="text-slate-600">Gestiona todas tus ventas y fuentes de ingresos</p>
        </div>
        <div className="flex gap-3">
          <label htmlFor="csv-upload">
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
              data-testid="csv-upload-input"
            />
            <Button className="bg-blue-600 hover:bg-blue-700" asChild>
              <span className="cursor-pointer">
                <Upload size={16} className="mr-2" />
                Importar CSV
              </span>
            </Button>
          </label>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-sale-button">
                <Plus size={16} className="mr-2" />
                Nueva Venta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSale ? 'Editar Venta' : 'Nueva Venta'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                    data-testid="sale-date-input"
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
                    data-testid="sale-amount-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({...formData, category_id: value})}>
                    <SelectTrigger data-testid="sale-category-select">
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
                  <Label>Método de Pago</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({...formData, payment_method: value})}>
                    <SelectTrigger data-testid="sale-payment-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Descripción (opcional)</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    data-testid="sale-description-input"
                  />
                </div>
                <Button type="submit" className="w-full" data-testid="sale-submit-button">
                  {editingSale ? 'Actualizar' : 'Crear'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="sales-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Fecha</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Monto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Categoría</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Pago</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Descripción</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Origen</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sales.map(sale => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900">{sale.date}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-emerald-600">${sale.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{getCategoryName(sale.category_id)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{sale.payment_method}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{sale.description || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sale.source === 'manual' ? 'bg-blue-100 text-blue-700' :
                      sale.source === 'csv' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {sale.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(sale)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        data-testid={`edit-sale-${sale.id}`}
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        data-testid={`delete-sale-${sale.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              No hay ventas registradas. Crea tu primera venta.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}