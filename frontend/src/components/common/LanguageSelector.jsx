import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Globe, Check, ChevronDown } from 'lucide-react';

export const LanguageSelector = () => {
  const { language, changeLanguage, supportedLanguages, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-xl text-sm font-semibold text-tea-muted hover:text-tea-text bg-tea-cardSubtle/70 hover:bg-tea-cardSubtle transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('select_language')}
      >
        <span className="text-base leading-none" aria-hidden="true">{currentLang.flag}</span>
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">{currentLang.code}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-tea-subtle transition-transform duration-180 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('select_language')}
          className="absolute right-0 mt-2 w-44 rounded-2xl bg-white shadow-soft-md border border-tea-border p-1.5 z-50 animate-fadeIn"
        >
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  changeLanguage(lang.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-tea cursor-pointer ${
                  isSelected
                    ? 'bg-brand-50 text-brand-700 font-bold'
                    : 'text-tea-text hover:bg-tea-cardSubtle'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none" aria-hidden="true">{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-brand-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
