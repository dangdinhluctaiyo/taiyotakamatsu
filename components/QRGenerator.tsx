import React, { useState, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Product } from '../types';
import { QrCode, Printer, Download, Check, Search, Image, Type, Hash, Settings, X } from 'lucide-react';

// Simple QR Code generator using canvas
const generateQRCode = (text: string, size: number): string => {
  // Using a simple QR code API for now
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
};

export const QRGenerator: React.FC<{ refreshApp: () => void }> = ({ refreshApp }) => {
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [qrSize, setQrSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showImage, setShowImage] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const sizes = {
    small: { qr: 80, card: 'w-32' },
    medium: { qr: 120, card: 'w-44' },
    large: { qr: 160, card: 'w-56' }
  };

  // Filter products
  const filteredProducts = db.products.filter(p => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s);
  });

  const toggleProduct = (id: number) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProducts(newSet);
  };

  const selectAll = () => {
    setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedProducts(new Set());
  };

  const handlePrint = () => {
    if (selectedProducts.size === 0) return;
    setShowPreview(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const selectedProductsList = db.products.filter(p => selectedProducts.has(p.id));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white px-4 pt-4 pb-8 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-xl">
              <QrCode className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">{t('qr_generator_title')}</h1>
          </div>
          <p className="text-purple-200 text-sm">{t('qr_generator_desc')}</p>
        </div>
      </div>

      <div className="px-4 -mt-4 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Left: Product Selection */}
            <div className="md:col-span-2 space-y-4">
              {/* Search & Actions */}
              <div className="bg-white rounded-2xl shadow-lg p-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('search_equipment')}
                      className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-medium hover:bg-purple-200 transition-all"
                    >
                      {t('select_all')}
                    </button>
                    <button
                      onClick={deselectAll}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-all"
                    >
                      {t('deselect_all')}
                    </button>
                  </div>
                </div>

                {/* Selected count */}
                {selectedProducts.size > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-purple-700 bg-purple-50 px-3 py-2 rounded-lg">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {t('selected_count').replace('{0}', String(selectedProducts.size))}
                    </span>
                  </div>
                )}
              </div>

              {/* Product List */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="divide-y max-h-[60vh] overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      {t('no_equipment_found')}
                    </div>
                  ) : (
                    filteredProducts.map(product => (
                      <label
                        key={product.id}
                        className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedProducts.has(product.id) ? 'bg-purple-50' : ''
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="w-14 h-14 rounded-xl object-cover bg-slate-100"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{product.name}</p>
                          <p className="text-sm text-slate-500">{product.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{t('in_stock')}</p>
                          <p className="font-bold text-slate-700">{product.currentPhysicalStock}/{product.totalOwned}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: Settings & Preview */}
            <div className="space-y-4">
              {/* Settings */}
              <div className="bg-white rounded-2xl shadow-lg p-5">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Cài đặt
                </h3>

                {/* QR Size */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">{t('qr_size')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setQrSize(size)}
                        className={`py-2 rounded-lg text-sm font-medium transition-all ${qrSize === size
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                      >
                        {size === 'small' ? t('small') : size === 'medium' ? t('medium') : t('large')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showImage}
                      onChange={(e) => setShowImage(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <Image className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{t('include_image')}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showName}
                      onChange={(e) => setShowName(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <Type className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{t('include_name')}</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCode}
                      onChange={(e) => setShowCode(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                    <Hash className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{t('include_code')}</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={selectedProducts.size === 0}
                  className="w-full py-3 bg-purple-100 text-purple-700 rounded-xl font-medium hover:bg-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <QrCode className="w-5 h-5" /> {t('preview')}
                </button>
                <button
                  onClick={handlePrint}
                  disabled={selectedProducts.size === 0}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> {t('print_all')}
                </button>
              </div>

              {/* Mini Preview */}
              {selectedProducts.size > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <h3 className="font-bold text-slate-800 mb-3">{t('preview')}</h3>
                  <div className="flex justify-center">
                    <QRCard
                      product={selectedProductsList[0]}
                      size={qrSize}
                      showImage={showImage}
                      showName={showName}
                      showCode={showCode}
                    />
                  </div>
                  {selectedProducts.size > 1 && (
                    <p className="text-center text-sm text-slate-500 mt-3">
                      +{selectedProducts.size - 1} sản phẩm khác
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-auto print-container">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10 print-header">
              <h3 className="font-bold text-lg">{t('preview')} - {selectedProducts.size} {t('products_count')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> {t('print_all')}
                </button>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div ref={printRef} className="p-6 print-content">
              <div className="flex flex-wrap gap-4 justify-center print:gap-2">
                {selectedProductsList.map(product => (
                  <QRCard
                    key={product.id}
                    product={product}
                    size={qrSize}
                    showImage={showImage}
                    showName={showName}
                    showCode={showCode}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(.print-container) {
            display: none !important;
          }
          .print-container {
            display: block !important;
            position: static !important;
            visibility: visible !important;
          }
          .print-container * {
            visibility: visible !important;
          }
          .print-container .print-header {
            display: none !important;
          }
          .print-container .print-content {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            justify-content: flex-start !important;
            align-content: flex-start !important;
          }
          .print-container .print-content > div {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};

// QR Card Component - Modern Design
const QRCard: React.FC<{
  product: Product;
  size: 'small' | 'medium' | 'large';
  showImage: boolean;
  showName: boolean;
  showCode: boolean;
}> = ({ product, size, showImage, showName, showCode }) => {
  const sizes = {
    small: { qr: 70, cardW: 'w-40', imgSize: 50, padding: 'p-2', gap: 'gap-2', nameText: 'text-[11px]', codeText: 'text-[9px]' },
    medium: { qr: 90, cardW: 'w-52', imgSize: 70, padding: 'p-3', gap: 'gap-3', nameText: 'text-xs', codeText: 'text-[10px]' },
    large: { qr: 120, cardW: 'w-64', imgSize: 90, padding: 'p-4', gap: 'gap-4', nameText: 'text-sm', codeText: 'text-xs' }
  };

  const s = sizes[size];
  const qrUrl = generateQRCode(product.code, s.qr);

  return (
    <div className={`${s.cardW} bg-white border border-slate-200 rounded-xl ${s.padding} shadow-sm print:shadow-none print:border-slate-300`}>
      {/* Top: Image + QR side by side */}
      <div className={`flex items-center justify-center ${s.gap}`}>
        {/* Product Image */}
        {showImage && (
          <div
            className="rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200"
            style={{ width: s.imgSize, height: s.imgSize }}
          >
            <img
              src={product.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* QR Code */}
        <div className="bg-white p-1 rounded-lg border border-slate-100">
          <img
            src={qrUrl}
            alt={`QR: ${product.code}`}
            style={{ width: s.qr, height: s.qr }}
          />
        </div>
      </div>

      {/* Bottom: Product Info */}
      {(showName || showCode) && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-center">
          {showName && (
            <p className={`${s.nameText} font-bold text-slate-800 truncate leading-tight`}>
              {product.name}
            </p>
          )}
          {showCode && (
            <p className={`${s.codeText} text-slate-500 font-mono mt-0.5 bg-slate-50 inline-block px-2 py-0.5 rounded`}>
              {product.code}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
