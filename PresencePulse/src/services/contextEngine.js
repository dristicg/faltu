/*
Presence Pulse – Phase 1 Behavior Detection Engine

GOAL:
Implement a simple rule-based behavior engine for detecting Attention Drift
based on session tracking and micro-check bursts.

Implement everything cleanly below this comment.
*/

import { insertSession, updateDailyMetrics } from '../database/databaseService';
import { triggerHapticNudge, shouldShowReflectionPrompt } from './nudgeEngine';
import { categorizeApp } from './appCategorizer';
import { isZenMode } from './zenService';

const MICRO_CHECK_THRESHOLD_SECONDS = 20;
const BURST_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const BURST_THRESHOLD = 5;

let driftThreshold = 5; // default = Normal

let currentSession = null;
let sessionHistory = [];
let microCheckCount = 0;
let attentionDrift = false;
let microCheckTimestamps = [];
let burstCount = 0;
let driftSeverity = 'None';

// Phase 3 & 8 Additions
let phubbingBurstCount = 0;
let dailyPhubbingEvents = 0;
let phubbingMicroChecks = 0; // NEW: track individual phubbing events
let phubbingPenaltyWeight = 1.0; 
let presenceDebt = 0;
let winCount5s = 0; // NEW: track 5s rule wins locally
let lossCount5s = 0; // NEW: track 5s rule losses locally

const logPrefix = '[PresencePulse]';

export function initializeStateFromStorage(metrics, lastTimestamp = 0) {
  if (metrics) {
    microCheckCount = metrics.microChecks || 0;
    burstCount = metrics.burstEvents || 0;
    dailyPhubbingEvents = metrics.phubbing_event_count || 0;
    phubbingMicroChecks = metrics.phubbing_micro_checks || 0;
    console.log(`${logPrefix} State verified from Sessions: MC=${microCheckCount}, Burst=${burstCount}, PhubbingMC=${phubbingMicroChecks}`);
  }
  if (lastTimestamp > 0) {
    lastProcessedTimestamp = lastTimestamp;
    console.log(`${logPrefix} Event processing resumed from: ${new Date(lastTimestamp).toLocaleString()}`);
  }
  
  // Sync verified state back to daily_metrics immediately
  triggerMetricsUpdate();
}

export let lastUnlockTimestamp = null;

export function registerScreenUnlock(timestamp) {
  lastUnlockTimestamp = timestamp;
  console.log(`${logPrefix} Screen unlocked at: ${new Date(timestamp).toLocaleTimeString()}`);
}

export function startSession() {
  if (currentSession) {
    console.log(`${logPrefix} Session already active; ignoring start request.`);
    return;
  }

  currentSession = {
    startTime: Date.now(),
  };

  console.log('Session started');
}

export function endSession() {
  if (!currentSession) {
    console.log(`${logPrefix} No active session to end.`);
    return null;
  }

  // Zen Mode: skip all processing
  if (isZenMode()) {
    currentSession = null;
    console.log(`${logPrefix} Zen Mode active — session discarded.`);
    return null;
  }

  const endTime = Date.now();
  const durationSeconds = (endTime - currentSession.startTime) / 1000;

  const sessionRecord = {
    startTime: currentSession.startTime,
    endTime,
    durationSeconds,
    type:
      durationSeconds < MICRO_CHECK_THRESHOLD_SECONDS
        ? 'micro-check'
        : 'session',
    packageName: 'PresencePulse', // Internal session
    category: 'utility' // Own app is always utility
  };

  sessionHistory.push(sessionRecord);
  currentSession = null;

  console.log(
    `Session ended with duration ${durationSeconds.toFixed(2)}s`
  );

  if (sessionRecord.type === 'micro-check') {
    // Only count micro-checks for the app's own sessions
    microCheckCount += 1;
    console.log(`Micro-check detected. Count: ${microCheckCount}`);
    trackBurst(endTime);
    triggerMetricsUpdate();
  } else {
    console.log(`${logPrefix} Standard session recorded.`);
  }

  updateDriftSeverity();

  // Async save to SQLite
  insertSession({
    ...sessionRecord,
    duration: Math.round(sessionRecord.durationSeconds)
  });

  return sessionRecord;
}

function triggerMetricsUpdate() {
  updateDailyMetrics({
    microChecks: microCheckCount,
    burstEvents: burstCount,
    phubbing_event_count: dailyPhubbingEvents,
    phubbing_micro_checks: phubbingMicroChecks,
    presenceScore: getPresenceScore()
  });
}

// Expose state mutators for UI to grab intervention status
let currentNudgeTier = 0; // 0=none, 1=haptic, 2=reflection, 3=reconnect

export const getCurrentNudgeTier = () => currentNudgeTier;
export const resetNudgeTier = () => { currentNudgeTier = 0; };

function trackBurst(referenceTime, socialContextFlag = false) {
  microCheckTimestamps.push(referenceTime);
  microCheckTimestamps = microCheckTimestamps.filter(
    (timestamp) => referenceTime - timestamp <= BURST_WINDOW_MS
  );

  console.log(`Burst count: ${microCheckTimestamps.length}`);

  if (microCheckTimestamps.length >= driftThreshold && !attentionDrift) {
    attentionDrift = true;
    burstCount += 1;
    console.log('Attention drift detected (Burst)');

    let shouldHaptic = false;
    if (socialContextFlag) {
      phubbingBurstCount += 1;
      dailyPhubbingEvents += 1; // Increment for daily metrics
      console.log(`${logPrefix} Phubbing event triggered from Burst!`);
      shouldHaptic = true;
    } else {
      console.log(`${logPrefix} Normal Burst Detected! Micro-checks: ${microCheckTimestamps.length}`);
      shouldHaptic = true;
    }

    // Fire Phase 6 Nudges asynchronously
    if (shouldHaptic) {
      triggerHapticNudge().then(fired => {
        if (fired) currentNudgeTier = Math.max(currentNudgeTier, 1);
      });
    }

    // Check if we should escalate based on repeated bursts
    shouldShowReflectionPrompt(microCheckTimestamps.length).then(shouldReflect => {
      if (shouldReflect) currentNudgeTier = Math.max(currentNudgeTier, 2);
    });

    // Escalate to Reconnect Block if excessive
    if (burstCount >= 5 || phubbingBurstCount >= 3) {
      currentNudgeTier = 3;
    }

    triggerMetricsUpdate();
  }

  updateDriftSeverity();
}

function updateDriftSeverity() {
  let nextSeverity = 'None';

  if (microCheckCount >= 13) {
    nextSeverity = 'Severe';
  } else if (microCheckCount >= 9) {
    nextSeverity = 'Moderate';
  } else if (microCheckCount >= 5) {
    nextSeverity = 'Mild';
  }

  if (nextSeverity !== driftSeverity) {
    driftSeverity = nextSeverity;
    console.log(`${logPrefix} Drift severity set to ${driftSeverity}.`);
  }
}

export function getAttentionDrift() {
  return attentionDrift;
}

export function getDriftSeverity() {
  return driftSeverity;
}

export function resetDrift() {
  attentionDrift = false;
  microCheckTimestamps = [];
  console.log(`${logPrefix} Attention drift state reset.`);
}

export function resetBurstState() {
  burstCount = 0;
  phubbingBurstCount = 0;
  attentionDrift = false;
  microCheckTimestamps = [];
  console.log(`${logPrefix} Burst counts reset after Reconnect intervention.`);
  triggerMetricsUpdate();
}

export function getSessionHistory() {
  return [...sessionHistory];
}

export function getMicroCheckCount() {
  return microCheckCount;
}

export function getBurstCount() {
  return burstCount;
}

export function getPresenceScore() {
  // Context-aware scoring: 
  // - 1% deduction per distraction micro-check (individual)
  // - 5% deduction per burst (macro behavior)
  // - 15% deduction per phubbing burst (social friction)
  
  const normalBursts = Math.max(0, burstCount - phubbingBurstCount);
  const weightedPhubbingCost = Math.round(phubbingBurstCount * 15 * phubbingPenaltyWeight);
  const microCheckCost = microCheckCount * 1; // Reduced to 1% for balance
  
  const score = 100 - (normalBursts * 5) - weightedPhubbingCost - microCheckCost;
  return Math.max(0, Math.floor(score));
}

export function getScoreCategory() {
  if (phubbingBurstCount > 0 || burstCount >= 4) {
    return 'Low';
  }

  if (microCheckCount >= 5) {
    return 'Medium';
  }

  const score = getPresenceScore();

  if (score >= 80) {
    return 'High';
  }

  if (score >= 50) {
    return 'Medium';
  }

  return 'Low';
}

export function setDriftThreshold(mode) {
  switch (mode) {
    case 'Strict':
      driftThreshold = 3;
      break;
    case 'Relaxed':
      driftThreshold = 7;
      break;
    case 'Normal':
    default:
      driftThreshold = BURST_THRESHOLD;
      break;
  }
}

export function getDriftThreshold() {
  return driftThreshold;
}

let lastProcessedTimestamp = 0;

export function analyzeUsageEvents(events, socialContext = false) {
  if (!events || !Array.isArray(events) || events.length === 0) return [];

  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const activeAppSessions = {};
  const newSessions = [];

  for (const event of sortedEvents) {
    const { packageName, timestamp, eventType } = event;

    if (eventType === 'FOREGROUND') {
      activeAppSessions[packageName] = timestamp;
    } else if (eventType === 'BACKGROUND') {
      const startTime = activeAppSessions[packageName];
      if (startTime && timestamp > startTime) {
        if (timestamp > lastProcessedTimestamp) {
          const durationSeconds = (timestamp - startTime) / 1000;

          if (durationSeconds >= 0.1) {
            const sessionRecord = {
              packageName,
              startTime,
              endTime: timestamp,
              duration: durationSeconds
            };
            newSessions.push(sessionRecord);
            processRealSession(sessionRecord, socialContext);
          }
        }
        delete activeAppSessions[packageName];
      }
    }
  }

  if (sortedEvents.length > 0) {
    const maxTime = Math.max(...sortedEvents.map(e => e.timestamp));
    if (maxTime > lastProcessedTimestamp) {
        // USP 5: 5-Second Rule Check
        // If we didn't open a distraction app within 5 seconds of unlock, it's a WIN
        // This is tricky within the loop, so we check "WIN" if a session starts much later or no session starts
        // But for "LOSS", it's easier: if a session starts < 5s after unlock.
        
        lastProcessedTimestamp = maxTime;
    }
  }

  return newSessions;
}

import { saveFiveSecondEvent } from '../database/databaseService';

const DISTRACTION_APPS = [
    'com.instagram.android', 'com.facebook.katana',
    'com.twitter.android', 'com.snapchat.android', 'com.reddit.frontpage'
];

function checkFiveSecondRule(sessionStartTime, packageName, socialContext) {
    if (!lastUnlockTimestamp) return;
    
    const timeDelta = sessionStartTime - lastUnlockTimestamp;
    if (timeDelta < 5000) {
        if (DISTRACTION_APPS.includes(packageName)) {
            console.log(`${logPrefix} 5-Second Rule LOST: Opened ${packageName} in ${timeDelta}ms`);
            saveFiveSecondEvent({
                timestamp: sessionStartTime,
                won: false,
                app_opened: packageName,
                is_social_context: socialContext ? 1 : 0
            });
            lossCount5s++;
        }
    } else {
        // Simple heuristic: if we accessed an app after 5s and it's the first one after unlock
        // but for real-time win rate, we'll increment if the delta is safe
        if (timeDelta >= 5000 && !DISTRACTION_APPS.includes(packageName)) {
           winCount5s++;
        }
    }
}

function processRealSession(session, socialContext, hasWhitelistedDevice = true) {
  // Zen Mode: skip all processing
  if (isZenMode()) {
    console.log(`${logPrefix} Zen Mode active — skipping session processing.`);
    return;
  }

  const durationSeconds = session.duration;
  const type = durationSeconds < MICRO_CHECK_THRESHOLD_SECONDS ? 'micro-check' : 'session';

  // USP 5: Check rule
  checkFiveSecondRule(session.startTime, session.packageName, socialContext);

  // App categorization: classify the package
  const category = categorizeApp(session.packageName);

  // Phase 3: Identify Triggers
  const timeSinceUnlock = lastUnlockTimestamp ? (session.startTime - lastUnlockTimestamp) : 99999;
  const triggerType = timeSinceUnlock < 15000 ? 'habit' : 'intentional';

  // Step 8: Social Context and Phubbing fields
  const is_social_context = socialContext ? 1 : 0;
  const isPhubbing = (type === 'micro-check' && socialContext) ? 1 : 0;

  if (isPhubbing) {
    phubbingMicroChecks += 1;
    dailyPhubbingEvents += 1; // For daily metrics table
  }

  // Refined social context: reduce phubbing penalty in public spaces
  if (socialContext && !hasWhitelistedDevice) {
    phubbingPenaltyWeight = 0.5;
    console.log(`${logPrefix} Public space detected — phubbing penalty reduced to 50%`);
  } else if (socialContext && hasWhitelistedDevice) {
    phubbingPenaltyWeight = 1.0;
    console.log(`${logPrefix} Whitelisted device nearby — full phubbing penalty`);
  }

  const record = {
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds,
    type,
    packageName: session.packageName,
    is_social_context,
    triggerType,
    isPhubbing,
    category
  };

  sessionHistory.push(record);
  console.log(`${logPrefix} Real session parsed: ${session.packageName} [${category}] (${durationSeconds.toFixed(2)}s) - ${type}. Trigger: ${triggerType}. SocialContext: ${Boolean(is_social_context)}`);

  if (type === 'micro-check') {
    // CONTEXT-AWARE FILTERING: Only count distraction micro-checks
    if (category === 'distraction') {
      microCheckCount += 1;
      console.log(`${logPrefix} DISTRACTION micro-check detected. Count: ${microCheckCount}`);
      trackBurst(session.endTime, socialContext);
      triggerMetricsUpdate();
    } else {
      console.log(`${logPrefix} ${category.toUpperCase()} micro-check — no score deduction. Package: ${session.packageName}`);
    }
  } else {
    updateDriftSeverity();
  }

  // Save parsed Android session to SQLite (all categories, for analytics)
  insertSession({
    ...record,
    duration: Math.round(durationSeconds)
  });
}

// USP 3: Presence Debt Score Calculation
export function calculatePresenceDebt(weeklyMetrics) {
    // weeklyMetrics: array of { date, phubbing_event_count, presenceScore }
    let debt = 0;
    // We filter out today's metrics from the baseline if it exists in the array
    const todayStr = new Date().toISOString().split('T')[0];
    
    weeklyMetrics.forEach(day => {
        if (day.date === todayStr) return; // We handle today separately for real-time
        
        const phubbingEvents = day.phubbing_events || day.phubbing_event_count || 0;
        debt += phubbingEvents * 10;
        if (phubbingEvents === 0 && (day.presenceScore || 0) >= 75) {
            debt = Math.max(0, debt - 15);
        }
    });
    
    presenceDebtBaseline = debt;
    return getPresenceDebt();
}

let presenceDebtBaseline = 0;

export function getPresenceDebt() {
    // Real-time debt: Baseline from past days + Current day's phubbing events
    return presenceDebtBaseline + (phubbingMicroChecks * 10);
}

export function getWinRate5s() {
    const total = winCount5s + lossCount5s;
    return total > 0 ? Math.round((winCount5s / total) * 100) : 0;
}

