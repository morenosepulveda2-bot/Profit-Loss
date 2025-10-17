import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, comparisonRes] = await Promise.all([
        axios.get(`${API}/dashboard/summary`),
        axios.get(`${API}/dashboard/comparison?months=6`)
      ]);
      setSummary(summaryRes.data);
      setComparison(comparisonRes.data);
    } catch (error) {
      toast.error('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const incomeData = Object.entries(summary?.income_by_category || {}).map(([name, value]) => ({
    name,
    value
  }));

  const expenseData = Object.entries(summary?.expenses_by_category || {}).map(([name, value]) => ({
    name,
    value
  }));

  const paymentData = Object.entries(summary?.sales_by_payment || {}).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Dashboard Financiero
        </h1>
        <p className="text-slate-600">Vista general de tu negocio</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="total-income-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <TrendingUp className="text-emerald-600" size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Ingresos Totales</p>
          <p className="text-3xl font-bold text-slate-900">${summary?.total_income?.toFixed(2) || '0.00'}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="total-cogs-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <DollarSign className="text-orange-600" size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">COGS (Costo de Ventas)</p>
          <p className="text-3xl font-bold text-orange-600">${summary?.total_cogs?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-slate-500 mt-1">
            {summary?.cogs_percentage?.toFixed(1) || '0.0'}% de las ventas
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            (${summary?.total_cogs?.toFixed(2) || '0.00'} ÷ ${summary?.total_income?.toFixed(2) || '0.00'} × 100)
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="gross-profit-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Target className="text-blue-600" size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Ganancia Bruta</p>
          <p className="text-3xl font-bold text-blue-600">${summary?.gross_profit?.toFixed(2) || '0.00'}</p>
          <p className="text-xs text-slate-500 mt-1">
            Margen: {summary?.gross_margin?.toFixed(1) || '0.0'}%
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="net-profit-card">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${summary?.net_profit >= 0 ? 'bg-purple-50' : 'bg-red-50'}`}>
              <TrendingDown className={summary?.net_profit >= 0 ? 'text-purple-600' : 'text-red-600'} size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Ganancia Neta</p>
          <p className={`text-3xl font-bold ${summary?.net_profit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
            ${summary?.net_profit?.toFixed(2) || '0.00'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Después de todos los gastos
          </p>
        </div>
      </div>

      {/* COGS Analysis Section */}
      {summary && summary.total_income > 0 && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Análisis COGS (Costo de Ventas)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-slate-600 mb-2">Ventas Totales</p>
              <p className="text-2xl font-bold text-emerald-600">${summary.total_income.toFixed(2)}</p>
              <div className="mt-2 h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: '100%' }}></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">100%</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-slate-600 mb-2">COGS (Costo de Ventas)</p>
              <p className="text-2xl font-bold text-orange-600">${summary.total_cogs.toFixed(2)}</p>
              <div className="mt-2 h-2 bg-orange-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500" style={{ width: `${summary.cogs_percentage}%` }}></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{summary.cogs_percentage.toFixed(1)}% de ventas</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <p className="text-sm text-slate-600 mb-2">Ganancia Bruta</p>
              <p className="text-2xl font-bold text-blue-600">${summary.gross_profit.toFixed(2)}</p>
              <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${summary.gross_margin}%` }}></div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{summary.gross_margin.toFixed(1)}% margen bruto</p>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white rounded-lg border border-orange-200">
            <p className="text-sm font-semibold text-slate-900 mb-2">Fórmula del % COGS:</p>
            <div className="space-y-1 text-sm text-slate-700">
              <p>• <span className="font-medium">% COGS</span> = (Gastos COGS ÷ Ingresos de Ventas) × 100</p>
              <p>• <span className="font-medium">% COGS</span> = (${summary.total_cogs.toFixed(2)} ÷ ${summary.total_income.toFixed(2)}) × 100 = <span className="font-bold text-orange-600">{summary.cogs_percentage.toFixed(2)}%</span></p>
              <p className="mt-2 text-xs text-slate-500">💡 Un % COGS más bajo indica mejor eficiencia (menos costo por cada venta)</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Month Comparison */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Comparación Mensual
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={comparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} name="Ingresos" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Gastos" />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Ganancia" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Income by Category */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Ingresos por Categoría
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={incomeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {incomeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses by Category */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Gastos por Categoría
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Métodos de Pago
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}