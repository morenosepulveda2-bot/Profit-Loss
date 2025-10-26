import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { X, Filter } from 'lucide-react';

export default function FilterPanel({ filters, onFilterChange, onClearFilters, categories, showPaymentMethod, showSource }) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          <X size={16} className="mr-1" />
          Clear All
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Date From */}
        <div className="space-y-2">
          <Label htmlFor="date_from" className="text-xs">Date From</Label>
          <Input
            id="date_from"
            type="date"
            value={filters.date_from || ''}
            onChange={(e) => onFilterChange('date_from', e.target.value)}
            className="h-9"
          />
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label htmlFor="date_to" className="text-xs">Date To</Label>
          <Input
            id="date_to"
            type="date"
            value={filters.date_to || ''}
            onChange={(e) => onFilterChange('date_to', e.target.value)}
            className="h-9"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-xs">Category</Label>
          <Select
            value={filters.category_id || 'all'}
            onValueChange={(value) => onFilterChange('category_id', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Method */}
        {showPaymentMethod && (
          <div className="space-y-2">
            <Label htmlFor="payment_method" className="text-xs">Payment Method</Label>
            <Select
              value={filters.payment_method || 'all'}
              onValueChange={(value) => onFilterChange('payment_method', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">{t('sales.cash')}</SelectItem>
                <SelectItem value="card">{t('sales.card')}</SelectItem>
                <SelectItem value="transfer">{t('sales.transfer')}</SelectItem>
                <SelectItem value="other">{t('sales.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Source */}
        {showSource && (
          <div className="space-y-2">
            <Label htmlFor="source" className="text-xs">Source</Label>
            <Select
              value={filters.source || 'all'}
              onValueChange={(value) => onFilterChange('source', value === 'all' ? '' : value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="manual">{t('sales.manual')}</SelectItem>
                <SelectItem value="csv">{t('sales.csv')}</SelectItem>
                <SelectItem value="toast">{t('sales.toast')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Min Amount */}
        <div className="space-y-2">
          <Label htmlFor="min_amount" className="text-xs">Min Amount</Label>
          <Input
            id="min_amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={filters.min_amount || ''}
            onChange={(e) => onFilterChange('min_amount', e.target.value)}
            className="h-9"
          />
        </div>

        {/* Max Amount */}
        <div className="space-y-2">
          <Label htmlFor="max_amount" className="text-xs">Max Amount</Label>
          <Input
            id="max_amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={filters.max_amount || ''}
            onChange={(e) => onFilterChange('max_amount', e.target.value)}
            className="h-9"
          />
        </div>

        {/* Description Search */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-xs">Search Description</Label>
          <Input
            id="description"
            type="text"
            placeholder="Search..."
            value={filters.description || ''}
            onChange={(e) => onFilterChange('description', e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Active Filters Count */}
      {Object.values(filters).filter(v => v !== '' && v !== null && v !== undefined).length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-sm text-blue-600">
            {Object.values(filters).filter(v => v !== '' && v !== null && v !== undefined).length} filter(s) active
          </p>
        </div>
      )}
    </div>
  );
}
