import React, { useState } from 'react';
import { i18n, Language } from '../services/i18n';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = i18n.getLanguage();
  const current = i18n.languages.find(l => l.code === currentLang);

  const handleChange = (lang: Language) => {
    i18n.setLanguage(lang);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <span className="text-lg">{current?.flag}</span>
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-50 min-w-[120px]">
            {i18n.languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleChange(lang.code as Language)}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 ${
                  currentLang === lang.code ? 'bg-blue-50 text-blue-600' : ''
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300"
      >
        <Globe className="w-4 h-4" />
        <span>{current?.flag} {current?.name}</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-1 bg-white rounded-lg shadow-lg border py-1 z-50 min-w-[140px]">
          {i18n.languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleChange(lang.code as Language)}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700 ${
                currentLang === lang.code ? 'bg-blue-50 text-blue-600' : ''
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
