import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Calendar, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ReportsPage() {
  const [filterType, setFilterType] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
    fetchComparison();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ filter_type: filterType });
      if (filterType === 'custom' && startDate && endDate) {
        params.append('start_date', startDate);
        params.append('end_date', endDate);
      }
      const response = await axios.get(`${API}/analytics/report?${params.toString()}`);
      setReportData(response.data);
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/comparison?months=12`);
      setComparison(response.data);
    } catch (error) {
      console.error('Error fetching comparison:', error);
    }
  };

  const handleGenerateReport = () => {
    if (filterType === 'custom' && (!startDate || !endDate)) {
      toast.error('Selecciona fechas de inicio y fin');
      return;
    }
    fetchReport();
  };

  const exportToCSV = () => {
    if (!reportData) return;

    const summary = reportData.summary;
    const csvRows = [
      ['Profit & Loss Report'],
      ['Period', `${reportData.start_date} to ${reportData.end_date}`],
      [''],
      ['Total Income', `$${summary.total_income.toFixed(2)}`],
      ['Total Expenses', `$${summary.total_expenses.toFixed(2)}`],
      ['Net Profit', `$${summary.net_profit.toFixed(2)}`],
      [''],
      ['Income by Category'],
      ...Object.entries(summary.income_by_category).map(([cat, val]) => [cat, `$${val.toFixed(2)}`]),
      [''],
      ['Expenses by Category'],
      ...Object.entries(summary.expenses_by_category).map(([cat, val]) => [cat, `$${val.toFixed(2)}`])
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profit-loss-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Reporte exportado');
  };

  const growthData = comparison.map((item, index) => ({
    month: item.month,
    growth: item.growth_percentage || 0
  })).filter(item => item.growth !== null);

  return (
    <div className="space-y-8" data-testid="reports-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Reportes & Análisis
        </h1>
        <p className="text-slate-600">Analiza tu desempeño financiero con filtros personalizados</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Filtros de Reporte</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="filter-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="quarter">Este Trimestre</SelectItem>
                <SelectItem value="year">Este Año</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterType === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="start-date-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Fin</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="end-date-input"
                />
              </div>
            </>
          )}
          <div className="flex items-end gap-2">
            <Button onClick={handleGenerateReport} className="bg-emerald-600 hover:bg-emerald-700" data-testid="generate-report-button">
              <Calendar size={16} className="mr-2" />
              Generar Reporte
            </Button>
            {reportData && (
              <Button onClick={exportToCSV} variant="outline" data-testid="export-csv-button">
                <Download size={16} className="mr-2" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp size={24} />
                <h3 className="text-base font-semibold">Ingresos Totales</h3>
              </div>
              <p className="text-3xl font-bold mb-2">${reportData.summary.total_income.toFixed(2)}</p>
              <p className="text-emerald-100 text-xs">
                Base para cálculo de %
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown size={24} />
                <h3 className="text-base font-semibold">COGS</h3>
              </div>
              <p className="text-3xl font-bold mb-2">${reportData.summary.total_cogs.toFixed(2)}</p>
              <p className="text-orange-100 text-xs">
                {reportData.summary.cogs_percentage.toFixed(1)}% de ventas
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <Calendar size={24} />
                <h3 className="text-base font-semibold">Ganancia Bruta</h3>
              </div>
              <p className="text-3xl font-bold mb-2">${reportData.summary.gross_profit.toFixed(2)}</p>
              <p className="text-blue-100 text-xs">
                Margen: {reportData.summary.gross_margin.toFixed(1)}%
              </p>
            </div>

            <div className={`bg-gradient-to-br rounded-xl p-6 text-white shadow-lg ${
              reportData.summary.net_profit >= 0 
                ? 'from-purple-500 to-purple-600' 
                : 'from-red-500 to-red-600'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown size={24} />
                <h3 className="text-base font-semibold">Ganancia Neta</h3>
              </div>
              <p className="text-3xl font-bold mb-2">${reportData.summary.net_profit.toFixed(2)}</p>
              <p className={reportData.summary.net_profit >= 0 ? 'text-purple-100' : 'text-red-100'} className="text-xs">
                Después de gastos
              </p>
            </div>
          </div>
          
          {/* COGS Breakdown */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Desglose % COGS vs Ventas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Cálculo del % COGS</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Ingresos de Ventas:</span>
                    <span className="font-bold text-emerald-600">${reportData.summary.total_income.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gastos COGS:</span>
                    <span className="font-bold text-orange-600">${reportData.summary.total_cogs.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">% COGS:</span>
                      <span className="font-bold text-lg text-orange-700">{reportData.summary.cogs_percentage.toFixed(2)}%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      (${reportData.summary.total_cogs.toFixed(2)} ÷ ${reportData.summary.total_income.toFixed(2)}) × 100
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      * Porcentaje de ventas que se va en costo
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Visualización</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Ventas</span>
                      <span className="font-medium">100%</span>
                    </div>
                    <div className="h-6 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: '100%' }}>
                        ${reportData.summary.total_income.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">COGS</span>
                      <span className="font-medium">{reportData.summary.cogs_percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-6 bg-orange-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${Math.max(reportData.summary.cogs_percentage, 15)}%` }}>
                        ${reportData.summary.total_cogs.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Ganancia Bruta</span>
                      <span className="font-medium">{reportData.summary.gross_margin.toFixed(1)}%</span>
                    </div>
                    <div className="h-6 bg-blue-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${Math.max(reportData.summary.gross_margin, 15)}%` }}>
                        ${reportData.summary.gross_profit.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Desglose de Ingresos
              </h3>
              <div className="space-y-3">
                {Object.entries(reportData.summary.income_by_category).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="text-slate-900 font-medium">{category}</span>
                    <span className="text-emerald-700 font-bold">${amount.toFixed(2)}</span>
                  </div>
                ))}
                {Object.keys(reportData.summary.income_by_category).length === 0 && (
                  <p className="text-center py-8 text-slate-500">Sin ingresos en este período</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Desglose de Gastos
              </h3>
              <div className="space-y-3">
                {Object.entries(reportData.summary.expenses_by_category).map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="text-slate-900 font-medium">{category}</span>
                    <span className="text-red-700 font-bold">${amount.toFixed(2)}</span>
                  </div>
                ))}
                {Object.keys(reportData.summary.expenses_by_category).length === 0 && (
                  <p className="text-center py-8 text-slate-500">Sin gastos en este período</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Growth Trend Chart */}
      {growthData.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Tendencia de Crecimiento Mensual
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="growth" 
                fill="#10b981" 
                name="Crecimiento (%)" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Month-to-Month Comparison Table */}
      {comparison.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Comparación Mes a Mes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Mes</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Ingresos</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Gastos</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Ganancia</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Crecimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {comparison.map(item => (
                  <tr key={item.month} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.month}</td>
                    <td className="px-6 py-4 text-sm text-right text-emerald-600 font-semibold">
                      ${item.income.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-red-600 font-semibold">
                      ${item.expenses.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-blue-600 font-bold">
                      ${item.profit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {item.growth_percentage !== null ? (
                        <span className={`font-semibold ${
                          item.growth_percentage >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {item.growth_percentage >= 0 ? '+' : ''}{item.growth_percentage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}