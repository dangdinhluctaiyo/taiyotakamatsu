/**
 * useHaptic - Hook for haptic feedback on mobile devices
 * Uses navigator.vibrate() for Android and attempts vibration for iOS
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

// Vibration patterns for different feedback types (in ms)
const PATTERNS: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 25,
    heavy: 50,
    success: [10, 50, 10], // Short burst pattern
    error: [50, 100, 50, 100, 50], // Long alarming pattern
    warning: [30, 50, 30] // Medium double tap
};

export const useHaptic = () => {
    const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

    const vibrate = (type: HapticType = 'light') => {
        if (!isSupported) return false;

        try {
            const pattern = PATTERNS[type];
            navigator.vibrate(pattern);
            return true;
        } catch {
            return false;
        }
    };

    // Convenience methods
    const light = () => vibrate('light');
    const medium = () => vibrate('medium');
    const heavy = () => vibrate('heavy');
    const success = () => vibrate('success');
    const error = () => vibrate('error');
    const warning = () => vibrate('warning');

    // Custom pattern
    const custom = (pattern: number | number[]) => {
        if (!isSupported) return false;
        try {
            navigator.vibrate(pattern);
            return true;
        } catch {
            return false;
        }
    };

    // Stop any ongoing vibration
    const stop = () => {
        if (!isSupported) return;
        navigator.vibrate(0);
    };

    return {
        isSupported,
        vibrate,
        light,
        medium,
        heavy,
        success,
        error,
        warning,
        custom,
        stop
    };
};

// Standalone function for use without hook
export const haptic = (type: HapticType = 'light') => {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
    try {
        navigator.vibrate(PATTERNS[type]);
        return true;
    } catch {
        return false;
    }
};

export default useHaptic;
