/*
Presence Pulse – Phase 1 Behavior Detection Engine

GOAL:
Implement a simple rule-based behavior engine for detecting Attention Drift
based on session tracking and micro-check bursts.

Implement everything cleanly below this comment.
*/

import { insertSession, updateDailyMetrics } from '../database/databaseService';

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

// Phase 3 Additions
let phubbingBurstCount = 0;

const logPrefix = '[PresencePulse]';

export function initializeStateFromStorage(metrics) {
  if (metrics) {
    microCheckCount = metrics.microChecks || 0;
    burstCount = metrics.burstEvents || 0;
    console.log(`${logPrefix} State restored from storage: MC=${microCheckCount}, Burst=${burstCount}`);
    console.log(`${logPrefix} No daily metrics found for today, starting fresh.`);
  }
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
    packageName: 'PresencePulse' // Internal session
  };

  sessionHistory.push(sessionRecord);
  currentSession = null;

  console.log(
    `Session ended with duration ${durationSeconds.toFixed(2)}s`
  );

  if (sessionRecord.type === 'micro-check') {
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
    duration: Math.round(sessionRecord.durationSeconds) // Database expects integers
  });

  return sessionRecord;
}

function triggerMetricsUpdate() {
  updateDailyMetrics({
    microChecks: microCheckCount,
    burstEvents: burstCount,
    presenceScore: getPresenceScore()
  });
}

function trackBurst(referenceTime, socialContext = false) {
  microCheckTimestamps.push(referenceTime);
  microCheckTimestamps = microCheckTimestamps.filter(
    (timestamp) => referenceTime - timestamp <= BURST_WINDOW_MS
  );

  console.log(`Burst count: ${microCheckTimestamps.length}`);

  if (microCheckTimestamps.length >= driftThreshold && !attentionDrift) {
    attentionDrift = true;
    burstCount += 1;
    console.log('Attention drift detected (Burst)');

    // Step 8: If burstDetected AND socialContext true, triggerPhubEvent
    if (socialContext) {
      phubbingBurstCount += 1;
      console.log(`${logPrefix} Phubbing event triggered from Burst!`);
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
  // Step 8: Normal burst = -10 points. Phubbing burst = -15 points.
  const normalBursts = Math.max(0, burstCount - phubbingBurstCount);
  const score = 100 - (normalBursts * 10) - (phubbingBurstCount * 15);
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

          const sessionRecord = {
            packageName,
            startTime,
            endTime: timestamp,
            duration: durationSeconds
          };
          newSessions.push(sessionRecord);

          processRealSession(sessionRecord, socialContext);
        }
        delete activeAppSessions[packageName];
      }
    }
  }

  if (sortedEvents.length > 0) {
    const maxTime = Math.max(...sortedEvents.map(e => e.timestamp));
    if (maxTime > lastProcessedTimestamp) {
      lastProcessedTimestamp = maxTime;
    }
  }

  return newSessions;
}

function processRealSession(session, socialContext) {
  const durationSeconds = session.duration;
  const type = durationSeconds < MICRO_CHECK_THRESHOLD_SECONDS ? 'micro-check' : 'session';

  // Phase 3: Identify Triggers
  const timeSinceUnlock = lastUnlockTimestamp ? (session.startTime - lastUnlockTimestamp) : 99999;
  const triggerType = timeSinceUnlock < 15000 ? 'habit' : 'intentional';

  // Step 8: Social Context and Phubbing fields
  const is_social_context = socialContext ? 1 : 0;
  const isPhubbing = (type === 'micro-check' && socialContext) ? 1 : 0;

  const record = {
    startTime: session.startTime,
    endTime: session.endTime,
    durationSeconds,
    type,
    packageName: session.packageName,
    is_social_context,
    triggerType,
    isPhubbing
  };

  sessionHistory.push(record);
  console.log(`${logPrefix} Real session parsed: ${session.packageName} (${durationSeconds.toFixed(2)}s) - ${type}. Trigger: ${triggerType}. SocialContext: ${Boolean(is_social_context)}`);

  if (type === 'micro-check') {
    microCheckCount += 1;
    console.log(`${logPrefix} Real Micro-check detected. Count: ${microCheckCount}`);
    trackBurst(session.endTime, socialContext);
    triggerMetricsUpdate();

    // Evaluate for a nudge
    const { evaluateAndNudge } = require('../engine/nudgeEngine');
    evaluateAndNudge(Boolean(isPhubbing));
  } else {
    updateDriftSeverity();
  }

  // Save parsed Android session to SQLite
  insertSession({
    ...record,
    duration: Math.round(durationSeconds) // Store duration as integer
  });
}

