import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useProperties, useDeleteProperty, useImportProperties } from '../hooks/useApi';
import { Plus, Building2, MapPin, DollarSign, MoreHorizontal, Trash2, Edit, Search, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

export default function PropertiesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editProp, setEditProp] = useState(null);
  const [filterPropType, setFilterPropType] = useState('');
  const [filterListType, setFilterListType] = useState('');
  const queryClient = useQueryClient();

  const { data: properties = [], isLoading: loading, error } = useProperties(filterPropType, filterListType);
  const deleteMutation = useDeleteProperty();
  const importMutation = useImportProperties();
  const invalidateProps = () => queryClient.invalidateQueries({ queryKey: ['properties'] });

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this property?')) return;
    deleteMutation.mutate(id);
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/properties/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'properties_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert('Export failed: ' + (err.response?.data?.detail || err.message)); }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/properties/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'property_import_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { alert('Download failed'); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    importMutation.mutate(formData, {
      onSuccess: ({ data }) => {
        alert(`Imported ${data.imported} of ${data.total_rows} properties.${data.errors?.length ? `\n\nErrors:\n${data.errors.join('\n')}` : ''}`);
      },
      onError: (err) => { alert('Import failed: ' + (err.response?.data?.detail || err.message)); },
    });
    e.target.value = '';
  };

  if (error) return <div className="p-4 sm:p-6 lg:p-8"><div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">Failed to load properties. Please try again.</div></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-5" data-testid="properties-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Properties</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-1">{properties.length} listings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5" data-testid="export-properties-btn">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5" data-testid="download-property-template-btn">
            <FileSpreadsheet className="w-4 h-4" /> Template
          </Button>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" data-testid="import-properties-btn">
              <Upload className="w-4 h-4" /> Import
            </Button>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-2" data-testid="add-property-button">
                <Plus className="w-4 h-4" /> Add Property
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg" data-testid="add-property-dialog">
            <DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
            <PropertyForm onSubmit={async (d) => { await api.post('/properties', d); setShowAdd(false); invalidateProps(); }} />
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap" data-testid="properties-filters">
        <Select value={filterPropType} onValueChange={v => setFilterPropType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9 text-sm bg-white dark:bg-slate-800"><SelectValue placeholder="Property Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterListType} onValueChange={v => setFilterListType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9 text-sm bg-white dark:bg-slate-800"><SelectValue placeholder="Listing Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listings</SelectItem>
            <SelectItem value="lease">Lease</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Property Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />)}</div>
      ) : properties.length === 0 ? (
        <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center" data-testid="properties-empty-state">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mb-3">No properties listed yet.</p>
          <Button onClick={() => setShowAdd(true)} className="bg-slate-900 text-white hover:bg-slate-800 gap-2"><Plus className="w-4 h-4" /> Add Property</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="properties-grid">
          {properties.map(p => (
            <div key={p.id} className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow" data-testid={`property-card-${p.id}`}>
              <div className="h-36 bg-slate-100 dark:bg-slate-700 relative overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-slate-300" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge className={`text-xs ${p.property_type === 'commercial' ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800'}`}>{p.property_type}</Badge>
                  <Badge className={`text-xs ${p.listing_type === 'sale' ? 'bg-green-100 text-green-800 dark:text-green-400' : 'bg-amber-100 text-amber-800 dark:text-amber-400'}`}>{p.listing_type}</Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {p.address}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-slate-100 dark:bg-slate-700 rounded" data-testid={`property-menu-${p.id}`}><MoreHorizontal className="w-4 h-4 text-slate-400 dark:text-slate-500" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditProp(p)}><Edit className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-red-600 dark:text-red-400"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
                  {p.price > 0 && <span className="flex items-center gap-0.5 font-semibold"><DollarSign className="w-3 h-3" /> {p.listing_type === 'lease' ? `${p.price.toLocaleString()}/mo` : p.price.toLocaleString()}</span>}
                  {p.sqft > 0 && <span>{p.sqft.toLocaleString()} sqft</span>}
                  {p.bedrooms > 0 && <span>{p.bedrooms} bed</span>}
                  {p.bathrooms > 0 && <span>{p.bathrooms} bath</span>}
                </div>
                <Badge variant="outline" className={`mt-2 text-xs ${p.status === 'active' ? 'border-green-300 text-green-700 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}>{p.status || 'active'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editProp} onOpenChange={(o) => { if (!o) setEditProp(null); }}>
        <DialogContent className="sm:max-w-lg" data-testid="edit-property-dialog">
          <DialogHeader><DialogTitle>Edit Property</DialogTitle></DialogHeader>
          {editProp && <PropertyForm initial={editProp} onSubmit={async (d) => { await api.put(`/properties/${editProp.id}`, d); setEditProp(null); invalidateProps(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PropertyForm({ initial, onSubmit }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    address: initial?.address || '',
    property_type: initial?.property_type || 'residential',
    listing_type: initial?.listing_type || 'lease',
    price: initial?.price || 0,
    sqft: initial?.sqft || 0,
    bedrooms: initial?.bedrooms || 0,
    bathrooms: initial?.bathrooms || 0,
    description: initial?.description || '',
    status: initial?.status || 'active',
    image_url: initial?.image_url || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try { await onSubmit(form); } catch (err) { alert(err.response?.data?.detail || err.message); }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Name *</Label>
        <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="bg-white border-slate-300 dark:border-slate-600" data-testid="property-form-name" />
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Address *</Label>
        <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} required className="bg-white border-slate-300 dark:border-slate-600" data-testid="property-form-address" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Property Type</Label>
          <Select value={form.property_type} onValueChange={v => setForm({...form, property_type: v})}>
            <SelectTrigger className="bg-white dark:bg-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Listing Type</Label>
          <Select value={form.listing_type} onValueChange={v => setForm({...form, listing_type: v})}>
            <SelectTrigger className="bg-white dark:bg-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lease">Lease</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Price ($)</Label>
          <Input type="number" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})} className="bg-white border-slate-300 dark:border-slate-600" data-testid="property-form-price" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Sqft</Label>
          <Input type="number" value={form.sqft} onChange={e => setForm({...form, sqft: parseFloat(e.target.value) || 0})} className="bg-white border-slate-300 dark:border-slate-600" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Beds</Label>
          <Input type="number" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: parseInt(e.target.value) || 0})} className="bg-white border-slate-300 dark:border-slate-600" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Baths</Label>
          <Input type="number" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: parseInt(e.target.value) || 0})} className="bg-white border-slate-300 dark:border-slate-600" />
        </div>
        <div>
          <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Status</Label>
          <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
            <SelectTrigger className="bg-white dark:bg-slate-800"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Image URL</Label>
        <Input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="https://..." className="bg-white border-slate-300 dark:border-slate-600" />
      </div>
      <div>
        <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Description</Label>
        <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} className="bg-white border-slate-300 dark:border-slate-600" />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-slate-900 text-white hover:bg-slate-800" data-testid="property-form-submit">
        {submitting ? 'Saving...' : initial ? 'Update Property' : 'Add Property'}
      </Button>
    </form>
  );
}
