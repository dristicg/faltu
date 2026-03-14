import { Vibration } from 'react-native';
import { getNudgeLog, saveNudge } from '../database/databaseService';

// Nudge cooldown tracking (in-memory fast checks)
let lastNudgeTime = 0;
let hourlyNudges = 0;
let currentHour = new Date().getHours();

export const shouldAllowNudge = async (nudgeType) => {
    const now = new Date();
    const hour = now.getHours();

    // Rule 2: No nudges between 11PM and 7AM
    if (hour >= 23 || hour < 7) {
        console.log('[NudgeEngine] Skipped: Outside allowed hours (11PM-7AM)');
        return false;
    }

    // Hourly reset
    if (hour !== currentHour) {
        hourlyNudges = 0;
        currentHour = hour;
    }

    // Rule 1: Max 50 nudges per hour for testing
    if (hourlyNudges >= 50) {
        console.log('[NudgeEngine] Skipped: Hourly limit reached (50)');
        return false;
    }

    // Check Database History
    const recentNudges = await getNudgeLog(3);

    // Rule 3: Bypassed for testing
    // if (recentNudges.length >= 3) {
    //     const allDismissed = recentNudges.every(n => n.dismissed === 1);
    //     if (allDismissed) {
    //         console.log('[NudgeEngine] Skipped: User fatigued (Dismissed last 3 nudges)');
    //         return false;
    //     }
    // }

    return true;
};

// TIER 1: Silent Haptic Nudge
export const triggerHapticNudge = async () => {
    const allowed = await shouldAllowNudge('haptic');
    if (!allowed) return false;

    console.log('[NudgeEngine] Triggering Haptic Nudge (Tier 1)');

    // Short double pulse: wait 0, vibrate 60, wait 80, vibrate 60
    Vibration.vibrate([0, 60, 80, 60]);

    hourlyNudges += 1;
    lastNudgeTime = Date.now();
    await saveNudge('haptic', false);
    return true;
};

// TIER 2: Reflection Logic
export const shouldShowReflectionPrompt = async (microCheckCountInWindow) => {
    if (microCheckCountInWindow < 3) return false;

    // Don't bombard back to back if they just saw one
    if (Date.now() - lastNudgeTime < 60000) return false;

    const allowed = await shouldAllowNudge('reflection');
    if (!allowed) return false;

    console.log('[NudgeEngine] Triggering Reflection Prompt (Tier 2)');
    hourlyNudges += 1;
    lastNudgeTime = Date.now();
    await saveNudge('reflection', false);
    return true;
};
