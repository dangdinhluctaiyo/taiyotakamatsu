import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { haptic } from '../hooks/useHaptic';

/**
 * ThemeToggle - iOS-style theme toggle button
 */
export const ThemeToggle: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
    const { theme, resolvedTheme, setTheme, toggleTheme, isDark } = useTheme();

    if (compact) {
        // Simple toggle button
        return (
            <button
                onClick={() => { haptic('light'); toggleTheme(); }}
                className={`p-2.5 rounded-full transition-all ${isDark
                        ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
        );
    }

    // Full segmented control
    return (
        <div className={`flex p-1 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <button
                onClick={() => { haptic('light'); setTheme('light'); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${theme === 'light'
                        ? isDark ? 'bg-slate-600 text-white' : 'bg-white text-slate-800 shadow-sm'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
            >
                <Sun className="w-4 h-4" />
                <span className="hidden sm:inline">Light</span>
            </button>
            <button
                onClick={() => { haptic('light'); setTheme('dark'); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${theme === 'dark'
                        ? isDark ? 'bg-slate-600 text-white' : 'bg-white text-slate-800 shadow-sm'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
            >
                <Moon className="w-4 h-4" />
                <span className="hidden sm:inline">Dark</span>
            </button>
            <button
                onClick={() => { haptic('light'); setTheme('system'); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${theme === 'system'
                        ? isDark ? 'bg-slate-600 text-white' : 'bg-white text-slate-800 shadow-sm'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
            >
                <Monitor className="w-4 h-4" />
                <span className="hidden sm:inline">Auto</span>
            </button>
        </div>
    );
};

export default ThemeToggle;
