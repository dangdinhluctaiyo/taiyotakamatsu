import React, { useState } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { KeyRound } from 'lucide-react';

interface Props {
    onSuccess: () => void;
    onCancel: () => void;
    setCode?: string;  // The equipment set code being scanned
}

export const PasscodeEntry: React.FC<Props> = ({ onSuccess, onCancel, setCode }) => {
    const [passcode, setPasscode] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (passcode.length < 4) {
            setError(t('passcode_min_4'));
            return;
        }

        const user = db.loginByPasscode(passcode);
        if (user) {
            onSuccess();
        } else {
            setError(t('passcode_incorrect'));
            setPasscode('');
        }
    };

    const handleKeyPress = (key: string) => {
        if (passcode.length < 6) {
            setPasscode(prev => prev + key);
            setError('');
        }
    };

    const handleBackspace = () => {
        setPasscode(prev => prev.slice(0, -1));
        setError('');
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6 z-50">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-teal-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">{t('enter_passcode')}</h1>
                {setCode && (
                    <p className="text-slate-400 text-sm">
                        {t('scanned_code')}: <span className="text-teal-400 font-mono">{setCode}</span>
                    </p>
                )}
            </div>

            {/* Passcode Display */}
            <div className="flex gap-3 mb-4">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${i < passcode.length
                                ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                                : 'border-slate-600 bg-slate-800 text-slate-400'
                            }`}
                    >
                        {i < passcode.length ? '•' : ''}
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <p className="text-red-400 text-sm mb-4">{error}</p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs w-full mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key) => (
                    <button
                        key={key}
                        onClick={() => {
                            if (key === 'back') handleBackspace();
                            else if (key) handleKeyPress(key);
                        }}
                        disabled={!key}
                        className={`h-14 rounded-xl font-bold text-xl transition-all ${key === 'back'
                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                : key
                                    ? 'bg-slate-700 text-white hover:bg-slate-600 active:scale-95'
                                    : 'bg-transparent'
                            }`}
                    >
                        {key === 'back' ? '⌫' : key}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full max-w-xs">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-medium hover:bg-slate-600"
                >
                    {t('cancel')}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={passcode.length < 4}
                    className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                    {t('confirm')}
                </button>
            </div>

            {/* Link to full login */}
            <button
                onClick={onCancel}
                className="mt-6 text-slate-400 text-sm hover:text-white"
            >
                {t('login_with_account')}
            </button>
        </div>
    );
};
