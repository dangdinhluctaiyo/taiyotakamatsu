import React, { useState } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { EquipmentSet, Product } from '../types';
import { Package, Plus, Trash2, QrCode, X, Save, Search, Edit2 } from 'lucide-react';
import QRCode from 'qrcode';

interface Props {
    refreshApp: () => void;
}

export const EquipmentSetManager: React.FC<Props> = ({ refreshApp }) => {
    const [showForm, setShowForm] = useState(false);
    const [editingSet, setEditingSet] = useState<EquipmentSet | null>(null);
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [showQR, setShowQR] = useState<EquipmentSet | null>(null);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (query.trim()) {
            const results = db.products.filter(p =>
                (p.name.toLowerCase().includes(query.toLowerCase()) ||
                    p.code.toLowerCase().includes(query.toLowerCase())) &&
                !selectedProductIds.includes(p.id)
            ).slice(0, 10);
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    };

    const addProduct = (product: Product) => {
        if (!selectedProductIds.includes(product.id)) {
            setSelectedProductIds([...selectedProductIds, product.id]);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const removeProduct = (productId: number) => {
        setSelectedProductIds(selectedProductIds.filter(id => id !== productId));
    };

    const handleSave = async () => {
        if (!name.trim() || selectedProductIds.length === 0) return;

        if (editingSet) {
            await db.updateEquipmentSet(editingSet.id, { name, note, productIds: selectedProductIds });
        } else {
            const code = db.generateSetCode();
            await db.addEquipmentSet({ name, code, productIds: selectedProductIds, note });
        }

        resetForm();
        refreshApp();
    };

    const handleEdit = (set: EquipmentSet) => {
        setEditingSet(set);
        setName(set.name);
        setNote(set.note || '');
        setSelectedProductIds([...set.productIds]);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm(t('confirm_delete_set'))) {
            await db.deleteEquipmentSet(id);
            refreshApp();
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingSet(null);
        setName('');
        setNote('');
        setSelectedProductIds([]);
    };

    const showQRCode = async (set: EquipmentSet) => {
        // Use URL format so native camera can open the app
        const baseUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://lucrental-pro.vercel.app';
        const qrData = `${baseUrl}/scan?code=${set.code}`;
        const dataUrl = await QRCode.toDataURL(qrData, { width: 256 });
        setQrDataUrl(dataUrl);
        setShowQR(set);
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white px-4 pt-4 pb-8 md:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-xl">
                                <Package className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">{t('equipment_set')}</h1>
                                <p className="text-teal-200 text-sm">{t('equipment_set_desc')}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowForm(true)}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-medium flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> {t('create_new')}
                        </button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="px-4 -mt-4 max-w-4xl mx-auto">
                {db.equipmentSets.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">{t('no_sets')}</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700"
                        >
                            {t('create_first_set')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {db.equipmentSets.map(set => (
                            <div key={set.id} className="bg-white rounded-2xl shadow-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-mono rounded">
                                                {set.code}
                                            </span>
                                            <h3 className="font-bold text-slate-800">{set.name}</h3>
                                        </div>
                                        {set.note && (
                                            <p className="text-sm text-slate-500 mt-1">{set.note}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => showQRCode(set)}
                                            className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200"
                                            title={t('show_qr')}
                                        >
                                            <QrCode className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(set)}
                                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                            title={t('edit')}
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(set.id)}
                                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                            title={t('delete')}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t pt-3">
                                    <p className="text-xs text-slate-400 mb-2">{(set.productIds || []).length} {t('equipment_count')}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {(set.productIds || []).map(productId => {
                                            const product = db.products.find(p => p.id === productId);
                                            return (
                                                <span
                                                    key={productId}
                                                    className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg"
                                                >
                                                    {product?.code || productId}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="font-bold text-lg">
                                {editingSet ? t('edit_set') : t('create_set')}
                            </h2>
                            <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {t('set_name')} *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Set A, Set B..."
                                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {t('set_note')}
                                </label>
                                <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                />
                            </div>

                            {/* Search Products */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {t('add_equipment_to_set')}
                                </label>
                                <div className="relative">
                                    <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        placeholder={t('search_equipment')}
                                        className="w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
                                    />
                                </div>

                                {/* Search Results */}
                                {searchResults.length > 0 && (
                                    <div className="mt-2 border rounded-xl max-h-40 overflow-y-auto">
                                        {searchResults.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => addProduct(p)}
                                                className="w-full px-4 py-2 text-left hover:bg-teal-50 flex items-center gap-3"
                                            >
                                                <Plus className="w-4 h-4 text-teal-600" />
                                                <span className="text-sm">
                                                    <strong>{p.code}</strong>: {p.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Products */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    {t('selected_equipment')} ({selectedProductIds.length})
                                </label>
                                {selectedProductIds.length === 0 ? (
                                    <div className="bg-slate-100 rounded-xl p-4 text-center text-slate-500 text-sm">
                                        {t('no_equipment_selected')}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedProductIds.map(productId => {
                                            const product = db.products.find(p => p.id === productId);
                                            return (
                                                <div
                                                    key={productId}
                                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                                                >
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm">{product?.name}</p>
                                                        <p className="text-xs text-slate-500">{product?.code}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeProduct(productId)}
                                                        className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t flex gap-3">
                            <button
                                onClick={resetForm}
                                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!name.trim() || selectedProductIds.length === 0}
                                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {showQR && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center">
                        <h3 className="font-bold text-lg mb-2">{showQR.name}</h3>
                        <p className="text-sm text-slate-500 mb-4">{t('set_code')}: {showQR.code}</p>
                        <div className="flex justify-center mb-4">
                            <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
                        </div>
                        <p className="text-xs text-slate-400 mb-4">
                            {t('scan_to_export_import')} {showQR.productIds.length} {t('equipment_count')}
                        </p>
                        <button
                            onClick={() => setShowQR(null)}
                            className="w-full py-3 bg-slate-100 rounded-xl font-medium hover:bg-slate-200"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
