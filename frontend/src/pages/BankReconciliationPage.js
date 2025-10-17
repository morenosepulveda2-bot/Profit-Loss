import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Plus, Upload, FileText, Check, X, RefreshCw, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function BankReconciliationPage() {
  const [checks, setChecks] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [reconciliationReport, setReconciliationReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkDialogOpen, setCheckDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [statementBalance, setStatementBalance] = useState('');
  
  const [checkFormData, setCheckFormData] = useState({
    check_number: '',
    date_issued: new Date().toISOString().split('T')[0],
    amount: '',
    payee: '',
    description: ''
  });

  const [transactionFormData, setTransactionFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'debit',
    check_number: ''
  });

  const [uploadFormData, setUploadFormData] = useState({
    period_start: '',
    period_end: '',
    starting_balance: '',
    ending_balance: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [checksRes, transactionsRes] = await Promise.all([
        axios.get(`${API}/checks`),
        axios.get(`${API}/bank-transactions`)
      ]);
      setChecks(checksRes.data);
      setBankTransactions(transactionsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCheck = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/checks`, checkFormData);
      toast.success('Cheque registrado');
      setCheckDialogOpen(false);
      setCheckFormData({
        check_number: '',
        date_issued: new Date().toISOString().split('T')[0],
        amount: '',
        payee: '',
        description: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Error al registrar cheque');
    }
  };

  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/bank-transactions`, transactionFormData);
      toast.success('Transacción bancaria registrada');
      setTransactionDialogOpen(false);
      setTransactionFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'debit',
        check_number: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Error al registrar transacción');
    }
  };

  const handleCancelCheck = async (checkId) => {
    if (window.confirm('¿Cancelar este cheque?')) {
      try {
        await axios.post(`${API}/checks/${checkId}/cancel`);
        toast.success('Cheque cancelado');
        fetchData();
      } catch (error) {
        toast.error('Error al cancelar cheque');
      }
    }
  };

  const handleMatchCheck = async (transactionId, checkId) => {
    try {
      await axios.post(`${API}/bank-transactions/${transactionId}/match-check/${checkId}`);
      toast.success('Cheque emparejado');
      fetchData();
    } catch (error) {
      toast.error('Error al emparejar cheque');
    }
  };

  const handleAutoMatch = async () => {
    try {
      const response = await axios.post(`${API}/bank-reconciliation/auto-match`);
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error('Error en emparejamiento automático');
    }
  };

  const handleUploadPDF = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('pdf-upload');
    const file = fileInput.files[0];
    
    if (!file) {
      toast.error('Selecciona un archivo PDF');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('period_start', uploadFormData.period_start);
      formData.append('period_end', uploadFormData.period_end);
      formData.append('starting_balance', uploadFormData.starting_balance);
      formData.append('ending_balance', uploadFormData.ending_balance);

      const response = await axios.post(`${API}/bank-statements/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.transactions_count === 0) {
        toast.warning(
          'No se detectaron transacciones automáticamente. Puedes agregarlas manualmente en la pestaña "Transacciones Bancarias".',
          { duration: 6000 }
        );
      } else {
        toast.success(response.data.message);
      }
      
      setUploadDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir PDF');
    }
  };

  const handleExtractText = async () => {
    const fileInput = document.getElementById('pdf-upload');
    const file = fileInput.files[0];
    
    if (!file) {
      toast.error('Selecciona un archivo PDF primero');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API}/bank-statements/extract-text`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Show extracted text in a modal or download
      const blob = new Blob([response.data.text], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${file.name}_extracted_text.txt`;
      a.click();
      
      toast.success('Texto extraído. Revisa el archivo descargado y agrega las transacciones manualmente.');
    } catch (error) {
      toast.error('Error al extraer texto del PDF');
    }
  };

  const handleGenerateReconciliation = async () => {
    if (!statementBalance) {
      toast.error('Ingresa el saldo del estado de cuenta');
      return;
    }

    try {
      const response = await axios.get(`${API}/bank-reconciliation/report`, {
        params: { statement_balance: parseFloat(statementBalance) }
      });
      setReconciliationReport(response.data);
    } catch (error) {
      toast.error('Error al generar conciliación');
    }
  };

  const handleDownloadInTransitReport = async () => {
    try {
      const response = await axios.get(`${API}/checks/in-transit-report`);
      const data = response.data;
      
      // Create CSV content
      const csvRows = [
        ['REPORTE DE CHEQUES EN TRÁNSITO'],
        ['Generado:', new Date().toLocaleString('es-MX')],
        [''],
        ['RESUMEN'],
        ['Total de Cheques:', data.total_checks],
        ['Monto Total:', `$${data.total_amount.toFixed(2)}`],
        [''],
        ['DETALLE POR ANTIGÜEDAD'],
        [''],
      ];

      // Add sections by age
      Object.entries(data.by_age).forEach(([age, info]) => {
        if (info.count > 0) {
          csvRows.push([age.toUpperCase(), `${info.count} cheques`, `$${info.amount.toFixed(2)}`]);
          csvRows.push(['Núm. Cheque', 'Fecha Emisión', 'Monto', 'Beneficiario', 'Descripción']);
          
          info.checks.forEach(check => {
            csvRows.push([
              check.check_number,
              check.date_issued,
              `$${check.amount.toFixed(2)}`,
              check.payee,
              check.description || ''
            ]);
          });
          csvRows.push([]);
        }
      });

      // Convert to CSV
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cheques-en-transito-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast.success('Reporte de cheques en tránsito descargado');
    } catch (error) {
      toast.error('Error al generar reporte');
    }
  };

  const pendingChecks = checks.filter(c => c.status === 'pending');
  const clearedChecks = checks.filter(c => c.status === 'cleared');
  const unmatchedTransactions = bankTransactions.filter(t => !t.matched_check_id && t.type === 'debit');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="bank-reconciliation-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Conciliación Bancaria
          </h1>
          <p className="text-slate-600">Controla cheques, transacciones bancarias y realiza el amarre</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" data-testid="upload-pdf-button">
                <Upload size={16} className="mr-2" />
                Subir Estado de Cuenta (PDF)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Subir Estado de Cuenta Bancario</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUploadPDF} className="space-y-4">
                <div className="space-y-2">
                  <Label>Archivo PDF</Label>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    className="w-full"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Período Inicio</Label>
                    <Input
                      type="date"
                      value={uploadFormData.period_start}
                      onChange={(e) => setUploadFormData({...uploadFormData, period_start: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Período Fin</Label>
                    <Input
                      type="date"
                      value={uploadFormData.period_end}
                      onChange={(e) => setUploadFormData({...uploadFormData, period_end: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Saldo Inicial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={uploadFormData.starting_balance}
                      onChange={(e) => setUploadFormData({...uploadFormData, starting_balance: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Saldo Final</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={uploadFormData.ending_balance}
                      onChange={(e) => setUploadFormData({...uploadFormData, ending_balance: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-2 font-medium">💡 Nota sobre extracción automática:</p>
                  <p className="text-xs text-blue-700">
                    El sistema intentará extraer transacciones automáticamente del PDF. Si no se detectan transacciones, 
                    puedes descargar el texto extraído para revisarlo o agregar las transacciones manualmente.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button type="button" onClick={handleExtractText} variant="outline" className="flex-1">
                    Ver Texto Extraído
                  </Button>
                  <Button type="submit" className="flex-1">Subir y Procesar</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Button onClick={handleAutoMatch} className="bg-purple-600 hover:bg-purple-700">
            <RefreshCw size={16} className="mr-2" />
            Emparejar Automático
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="checks" className="w-full">
        <TabsList>
          <TabsTrigger value="checks">Cheques ({checks.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones Bancarias ({bankTransactions.length})</TabsTrigger>
          <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
        </TabsList>

        {/* Cheques Tab */}
        <TabsContent value="checks" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-sm text-yellow-700">Cheques Pendientes</p>
                <p className="text-2xl font-bold text-yellow-900">{pendingChecks.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-700">Cheques Cobrados</p>
                <p className="text-2xl font-bold text-green-900">{clearedChecks.length}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700">Total en Tránsito</p>
                <p className="text-2xl font-bold text-blue-900">
                  ${pendingChecks.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}
                </p>
              </div>
            </div>

            <Dialog open={checkDialogOpen} onOpenChange={setCheckDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-check-button">
                  <Plus size={16} className="mr-2" />
                  Registrar Cheque
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Nuevo Cheque</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCheck} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Número de Cheque</Label>
                    <Input
                      value={checkFormData.check_number}
                      onChange={(e) => setCheckFormData({...checkFormData, check_number: e.target.value})}
                      required
                      data-testid="check-number-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de Emisión</Label>
                    <Input
                      type="date"
                      value={checkFormData.date_issued}
                      onChange={(e) => setCheckFormData({...checkFormData, date_issued: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={checkFormData.amount}
                      onChange={(e) => setCheckFormData({...checkFormData, amount: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>A Favor De (Beneficiario)</Label>
                    <Input
                      value={checkFormData.payee}
                      onChange={(e) => setCheckFormData({...checkFormData, payee: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción (opcional)</Label>
                    <Input
                      value={checkFormData.description}
                      onChange={(e) => setCheckFormData({...checkFormData, description: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full">Registrar Cheque</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Checks Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Núm. Cheque</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Fecha Emisión</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Monto</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Beneficiario</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Estado</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Fecha Cobrado</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {checks.map(check => (
                    <tr key={check.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">#{check.check_number}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{check.date_issued}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">${check.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{check.payee}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          check.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          check.status === 'cleared' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {check.status === 'pending' ? 'Pendiente' :
                           check.status === 'cleared' ? 'Cobrado' : 'Cancelado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{check.date_cleared || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        {check.status === 'pending' && (
                          <button
                            onClick={() => handleCancelCheck(check.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {checks.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No hay cheques registrados. Registra tu primer cheque.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Bank Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus size={16} className="mr-2" />
                  Agregar Transacción Manual
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Transacción Bancaria</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTransaction} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={transactionFormData.date}
                      onChange={(e) => setTransactionFormData({...transactionFormData, date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={transactionFormData.type} onValueChange={(value) => setTransactionFormData({...transactionFormData, type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">Débito (Salida)</SelectItem>
                        <SelectItem value="credit">Crédito (Entrada)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={transactionFormData.amount}
                      onChange={(e) => setTransactionFormData({...transactionFormData, amount: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      value={transactionFormData.description}
                      onChange={(e) => setTransactionFormData({...transactionFormData, description: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Cheque (opcional)</Label>
                    <Input
                      value={transactionFormData.check_number}
                      onChange={(e) => setTransactionFormData({...transactionFormData, check_number: e.target.value})}
                    />
                  </div>
                  <Button type="submit" className="w-full">Agregar Transacción</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Fecha</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Descripción</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Tipo</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Monto</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Cheque #</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Estado</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Match Manual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {bankTransactions.map(transaction => (
                    <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900">{transaction.date}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{transaction.description}</td>
                      <td className="px-6 py-4 text-sm">
                        {transaction.type === 'debit' ? (
                          <span className="text-red-600 flex items-center gap-1">
                            <TrendingDown size={14} /> Débito
                          </span>
                        ) : (
                          <span className="text-green-600 flex items-center gap-1">
                            <TrendingUp size={14} /> Crédito
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">${transaction.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{transaction.check_number || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        {transaction.matched_check_id ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <Check size={14} /> Matched
                          </span>
                        ) : (
                          <span className="text-yellow-600">Sin emparejar</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!transaction.matched_check_id && transaction.type === 'debit' && pendingChecks.length > 0 && (
                          <Select onValueChange={(checkId) => handleMatchCheck(transaction.id, checkId)}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Emparejar" />
                            </SelectTrigger>
                            <SelectContent>
                              {pendingChecks.map(check => (
                                <SelectItem key={check.id} value={check.id}>
                                  #{check.check_number} - ${check.amount}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {bankTransactions.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No hay transacciones bancarias. Sube un estado de cuenta o agrégalas manualmente.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Generar Conciliación Bancaria
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Saldo según Estado de Cuenta</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={statementBalance}
                  onChange={(e) => setStatementBalance(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleGenerateReconciliation} className="w-full">
                  <FileText size={16} className="mr-2" />
                  Generar Conciliación
                </Button>
              </div>
            </div>
          </div>

          {reconciliationReport && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <p className="text-sm text-blue-700 mb-2">Saldo Bancario</p>
                  <p className="text-3xl font-bold text-blue-900">
                    ${reconciliationReport.statement_balance.toFixed(2)}
                  </p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-200">
                  <p className="text-sm text-yellow-700 mb-2">Cheques en Tránsito</p>
                  <p className="text-3xl font-bold text-yellow-900">
                    ${reconciliationReport.outstanding_checks_total.toFixed(2)}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    {reconciliationReport.outstanding_checks.length} cheques
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <p className="text-sm text-green-700 mb-2">Depósitos en Tránsito</p>
                  <p className="text-3xl font-bold text-green-900">
                    ${reconciliationReport.deposits_in_transit_total.toFixed(2)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {reconciliationReport.deposits_in_transit.length} depósitos
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                  <p className="text-sm text-purple-700 mb-2">Saldo Conciliado</p>
                  <p className="text-3xl font-bold text-purple-900">
                    ${reconciliationReport.reconciled_balance.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Detailed Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Outstanding Checks */}
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Cheques en Tránsito ({reconciliationReport.outstanding_checks.length})
                  </h3>
                  <div className="space-y-2">
                    {reconciliationReport.outstanding_checks.map(check => (
                      <div key={check.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-900">#{check.check_number}</p>
                          <p className="text-xs text-slate-600">{check.payee}</p>
                        </div>
                        <p className="text-sm font-bold text-yellow-700">${check.amount.toFixed(2)}</p>
                      </div>
                    ))}
                    {reconciliationReport.outstanding_checks.length === 0 && (
                      <p className="text-center py-4 text-slate-500 text-sm">No hay cheques en tránsito</p>
                    )}
                  </div>
                </div>

                {/* Deposits in Transit */}
                <div className="bg-white rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Depósitos en Tránsito ({reconciliationReport.deposits_in_transit.length})
                  </h3>
                  <div className="space-y-2">
                    {reconciliationReport.deposits_in_transit.map((deposit, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{deposit.description}</p>
                          <p className="text-xs text-slate-600">{deposit.date}</p>
                        </div>
                        <p className="text-sm font-bold text-green-700">${deposit.amount.toFixed(2)}</p>
                      </div>
                    ))}
                    {reconciliationReport.deposits_in_transit.length === 0 && (
                      <p className="text-center py-4 text-slate-500 text-sm">No hay depósitos en tránsito</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Reconciliation Formula */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Fórmula de Conciliación</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-slate-700">Saldo según Banco:</span>
                    <span className="font-bold text-blue-700">${reconciliationReport.statement_balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-slate-700">+ Depósitos en Tránsito:</span>
                    <span className="font-bold text-green-700">+${reconciliationReport.deposits_in_transit_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-slate-700">- Cheques en Tránsito:</span>
                    <span className="font-bold text-yellow-700">-${reconciliationReport.outstanding_checks_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-100 rounded-lg border-2 border-purple-300">
                    <span className="font-bold text-slate-900">= Saldo Conciliado:</span>
                    <span className="font-bold text-lg text-purple-700">${reconciliationReport.reconciled_balance.toFixed(2)}</span>
                  </div>
                  {Math.abs(reconciliationReport.difference) > 0.01 && (
                    <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg border border-red-300">
                      <span className="text-red-700">⚠️ Diferencia:</span>
                      <span className="font-bold text-red-700">${reconciliationReport.difference.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
