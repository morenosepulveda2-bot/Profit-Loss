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

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="total-expenses-card">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Gastos Totales</p>
          <p className="text-3xl font-bold text-slate-900">${summary?.total_expenses?.toFixed(2) || '0.00'}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid="net-profit-card">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${summary?.net_profit >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <Target className={summary?.net_profit >= 0 ? 'text-blue-600' : 'text-orange-600'} size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Ganancia Neta</p>
          <p className={`text-3xl font-bold ${summary?.net_profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            ${summary?.net_profit?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <DollarSign className="text-purple-600" size={24} />
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-1">Margen de Ganancia</p>
          <p className="text-3xl font-bold text-slate-900">
            {summary?.total_income > 0 
              ? ((summary.net_profit / summary.total_income) * 100).toFixed(1)
              : '0.0'}%
          </p>
        </div>
      </div>

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