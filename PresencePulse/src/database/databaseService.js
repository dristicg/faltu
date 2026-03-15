import SQLite from 'react-native-sqlite-storage';
import { isZenMode } from '../services/zenService';

SQLite.enablePromise(true);

let db = null;

export const getDb = () => db;

export const initDatabase = async () => {
    try {
        db = await SQLite.openDatabase({
            name: 'PresencePulse.db',
            location: 'default',
        });

        console.log('[PresencePulse DB] Database initialized');

        // Clean up old sessions (keep last 30 days) to prevent uncontrolled data growth
        await cleanOldSessions(30);

        // Create tables
        await db.executeSql(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        packageName TEXT,
        startTime INTEGER,
        endTime INTEGER,
        duration INTEGER,
        type TEXT,
        socialContext INTEGER DEFAULT 0,
        triggerType TEXT,
        isPhubbing INTEGER DEFAULT 0,
        is_social_context INTEGER DEFAULT 0
      );
    `);

        const addColumn = async (sql) => {
            try {
                await db.executeSql(sql);
            } catch (e) {
                // Column already exists, ignore
            }
        };

        await addColumn('ALTER TABLE sessions ADD COLUMN socialContext INTEGER DEFAULT 0');
        await addColumn('ALTER TABLE sessions ADD COLUMN triggerType TEXT');
        await addColumn('ALTER TABLE sessions ADD COLUMN isPhubbing INTEGER DEFAULT 0');
        await addColumn('ALTER TABLE sessions ADD COLUMN is_social_context INTEGER DEFAULT 0');
        await addColumn("ALTER TABLE sessions ADD COLUMN category TEXT DEFAULT 'unknown'");

        await db.executeSql(`
      CREATE TABLE IF NOT EXISTS daily_metrics (
        date TEXT PRIMARY KEY,
        microChecks INTEGER,
        burstEvents INTEGER,
        phubbing_event_count INTEGER DEFAULT 0,
        social_context_minutes INTEGER DEFAULT 0,
        presenceScore INTEGER,
        checkin_done INTEGER DEFAULT 0,
        checkin_response TEXT
      );
    `);

        await addColumn('ALTER TABLE daily_metrics ADD COLUMN phubbing_event_count INTEGER DEFAULT 0');
        await addColumn('ALTER TABLE daily_metrics ADD COLUMN social_context_minutes INTEGER DEFAULT 0');
        await addColumn('ALTER TABLE daily_metrics ADD COLUMN checkin_done INTEGER DEFAULT 0');
        await addColumn('ALTER TABLE daily_metrics ADD COLUMN checkin_response TEXT');

        await db.executeSql(`
          CREATE TABLE IF NOT EXISTS five_second_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            won INTEGER NOT NULL,
            app_opened TEXT,
            is_social_context INTEGER DEFAULT 0
          );
        `);

        await db.executeSql(`
      CREATE TABLE IF NOT EXISTS ai_insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE,
        insight_text TEXT,
        generated_at TEXT
      );
    `);

        await db.executeSql(`
      CREATE TABLE IF NOT EXISTS nudges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        timestamp INTEGER,
        dismissed INTEGER DEFAULT 0,
        engaged INTEGER DEFAULT 0
      );
    `);

        await db.executeSql(`
      CREATE TABLE IF NOT EXISTS reflections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        trigger_type TEXT,
        session_id TEXT
      );
    `);

        console.log('[PresencePulse DB] Tables verified/created');
    } catch (error) {
        console.error('[PresencePulse DB] Initialization error:', error);
    }
};

export const insertSession = async (session) => {
    if (!db) return;
    if (isZenMode()) {
        console.log('[PresencePulse DB] Zen Mode active — skipping session insert');
        return;
    }
    try {
        const { packageName, startTime, endTime, duration, type, socialContext = 0, is_social_context = 0, triggerType = 'unknown', isPhubbing = 0, category = 'unknown' } = session;
        await db.executeSql(
            `INSERT INTO sessions (packageName, startTime, endTime, duration, type, socialContext, triggerType, isPhubbing, is_social_context, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [packageName, startTime, endTime, duration, type, socialContext ? 1 : 0, triggerType, isPhubbing ? 1 : 0, is_social_context ? 1 : 0, category]
        );
        console.log(`[PresencePulse DB] Inserted session: ${type} for ${packageName} [${category}]. Social context flag: ${is_social_context}`);
    } catch (error) {
        console.error('[PresencePulse DB] Insert session error:', error);
    }
};

export const getAllSessions = async () => {
    if (!db) return [];
    try {
        const [results] = await db.executeSql('SELECT * FROM sessions ORDER BY startTime DESC');
        const sessions = [];
        for (let i = 0; i < results.rows.length; i++) {
            sessions.push(results.rows.item(i));
        }
        return sessions;
    } catch (error) {
        console.error('[PresencePulse DB] Get all sessions error:', error);
        return [];
    }
};

export const getTodaySessions = async () => {
    if (!db) return [];
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayMs = startOfDay.getTime();

        const [results] = await db.executeSql(
            'SELECT * FROM sessions WHERE startTime >= ? ORDER BY startTime DESC',
            [startOfDayMs]
        );

        const sessions = [];
        for (let i = 0; i < results.rows.length; i++) {
            sessions.push(results.rows.item(i));
        }
        return sessions;
    } catch (error) {
        console.error('[PresencePulse DB] Get today sessions error:', error);
        return [];
    }
};

export const updateDailyMetrics = async (metrics) => {
    if (!db) return;
    if (isZenMode()) {
        console.log('[PresencePulse DB] Zen Mode active — skipping metrics update');
        return;
    }
    try {
        const { microChecks, burstEvents, presenceScore, phubbing_event_count = 0, social_context_minutes = 0 } = metrics;

        // Get current local date in YYYY-MM-DD
        const date = new Date().toISOString().split('T')[0];

        await db.executeSql(
            `INSERT OR REPLACE INTO daily_metrics (date, microChecks, burstEvents, phubbing_event_count, social_context_minutes, presenceScore) VALUES (?, ?, ?, ?, ?, ?)`,
            [date, microChecks, burstEvents, phubbing_event_count, social_context_minutes, presenceScore]
        );
        console.log(`[PresencePulse DB] Updated metrics for ${date}: MC=${microChecks}, Burst=${burstEvents}, Phubbing=${phubbing_event_count}, Score=${presenceScore}`);
    } catch (error) {
        console.error('[PresencePulse DB] Update daily metrics error:', error);
    }
};

export const updateCheckInStatus = async (done, response) => {
    if (!db) return;
    try {
        const date = new Date().toISOString().split('T')[0];
        await db.executeSql(
            `UPDATE daily_metrics SET checkin_done = ?, checkin_response = ? WHERE date = ?`,
            [done ? 1 : 0, response, date]
        );
        console.log(`[PresencePulse DB] Updated check-in status for ${date}: Done=${done}`);
    } catch (error) {
        console.error('[PresencePulse DB] Update check-in status error:', error);
    }
};

export const getDailyMetrics = async () => {
    if (!db) return null;
    try {
        const date = new Date().toISOString().split('T')[0];
        const [results] = await db.executeSql('SELECT * FROM daily_metrics WHERE date = ?', [date]);

        if (results.rows.length > 0) {
            return results.rows.item(0);
        }
        return null; // No metrics for today yet
    } catch (error) {
        console.error('[PresencePulse DB] Get daily metrics error:', error);
        return null;
    }
};

export const clearDatabase = async () => {
    if (!db) return;
    try {
        await db.executeSql('DELETE FROM sessions');
        await db.executeSql('DELETE FROM daily_metrics');
        console.log('[PresencePulse DB] Database cleared.');
    } catch (error) {
        console.error('[PresencePulse DB] Clear database error:', error);
    }
};

export const cleanOldSessions = async (daysToKeep = 30) => {
    if (!db) return;
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysToKeep);
        const thresholdMs = thresholdDate.getTime();

        const [results] = await db.executeSql(
            'DELETE FROM sessions WHERE startTime < ?',
            [thresholdMs]
        );
        console.log(`[PresencePulse DB] Cleaned up old sessions before ${thresholdDate.toISOString()} - rows affected: ${results.rowsAffected}`);
    } catch (error) {
        console.error('[PresencePulse DB] Clean old sessions error:', error);
    }
};

export const getCachedInsight = async (date) => {
    if (!db) return null;
    try {
        const [results] = await db.executeSql('SELECT * FROM ai_insights WHERE date = ?', [date]);
        if (results.rows.length > 0) {
            console.log('[PresencePulse] Using cached insight');
            return results.rows.item(0);
        }
        return null;
    } catch (error) {
        console.error('[PresencePulse DB] Get cached insight error:', error);
        return null;
    }
};

export const saveInsight = async (date, insightText) => {
    if (!db) return;
    try {
        const generatedAt = new Date().toISOString();
        await db.executeSql(
            `INSERT OR REPLACE INTO ai_insights (date, insight_text, generated_at) VALUES (?, ?, ?)`,
            [date, insightText, generatedAt]
        );
        console.log(`[PresencePulse DB] Saved AI insight for ${date}`);
    } catch (error) {
        console.error('[PresencePulse DB] Save insight error:', error);
    }
};

export const getSessionsForDate = async (dateStr) => {
    if (!db) return [];
    try {
        const [results] = await db.executeSql(
            `SELECT
             id,
             packageName as package_name,
             startTime as start_time,
             endTime as end_time,
             duration,
             type as session_type,
             is_social_context,
             isPhubbing
            FROM sessions
            WHERE date(startTime / 1000, 'unixepoch', 'localtime') = date(?)
            ORDER BY start_time ASC`,
            [dateStr]
        );
        const sessions = [];
        for (let i = 0; i < results.rows.length; i++) {
            sessions.push(results.rows.item(i));
        }
        return sessions;
    } catch (error) {
        console.error('[PresencePulse DB] Get sessions for date error:', error);
        return [];
    }
};

export const saveNudge = async (type, dismissed = false) => {
    if (!db) return;
    try {
        await db.executeSql(
            `INSERT INTO nudges (type, timestamp, dismissed, engaged) VALUES (?, ?, ?, ?)`,
            [type, Date.now(), dismissed ? 1 : 0, 0]
        );
        console.log(`[PresencePulse DB] Saved ${type} nudge`);
    } catch (error) {
        console.error('[PresencePulse DB] Save nudge error:', error);
    }
};

export const getNudgeLog = async (limit = 10) => {
    if (!db) return [];
    try {
        const [results] = await db.executeSql(
            'SELECT * FROM nudges ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );
        const nudges = [];
        for (let i = 0; i < results.rows.length; i++) {
            nudges.push(results.rows.item(i));
        }
        return nudges;
    } catch (error) {
        console.error('[PresencePulse DB] Get nudge log error:', error);
        return [];
    }
};

export const markNudgeDismissed = async () => {
    if (!db) return;
    try {
        await db.executeSql(
            'UPDATE nudges SET dismissed = 1 WHERE id = (SELECT id FROM nudges ORDER BY timestamp DESC LIMIT 1)'
        );
        console.log(`[PresencePulse DB] Nudge marked as dismissed`);
    } catch (error) {
        console.error('[PresencePulse DB] Mark nudge dismissed error:', error);
    }
};

export const markNudgeEngaged = async () => {
    if (!db) return;
    try {
        await db.executeSql(
            'UPDATE nudges SET engaged = 1 WHERE id = (SELECT id FROM nudges ORDER BY timestamp DESC LIMIT 1)'
        );
        console.log(`[PresencePulse DB] Nudge marked as engaged`);
    } catch (error) {
        console.error('[PresencePulse DB] Mark nudge engaged error:', error);
    }
};

export const saveReflection = async (triggerType, sessionId = null) => {
    if (!db) return;
    try {
        await db.executeSql(
            `INSERT INTO reflections (timestamp, trigger_type, session_id) VALUES (?, ?, ?)`,
            [Date.now(), triggerType, sessionId]
        );
        console.log(`[PresencePulse DB] Saved user reflection: ${triggerType}`);
    } catch (error) {
        console.error('[PresencePulse DB] Save reflection error:', error);
    }
};

// ─── Phase 7: Behavioral Pattern Intelligence Queries ─────────────────

export const getVulnerableHour = async (daysBack = 7) => {
    if (!db) return { hour: -1, micro_check_count: 0 };
    try {
        const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
        const [results] = await db.executeSql(
            `SELECT CAST(strftime('%H', startTime / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
                    COUNT(*) AS micro_check_count
             FROM sessions
             WHERE type = 'micro-check' AND startTime >= ?
             GROUP BY hour
             ORDER BY micro_check_count DESC
             LIMIT 1`,
            [cutoff]
        );
        if (results.rows.length > 0) {
            const row = results.rows.item(0);
            return { hour: row.hour, micro_check_count: row.micro_check_count };
        }
        return { hour: -1, micro_check_count: 0 };
    } catch (error) {
        console.error('[PresencePulse DB] getVulnerableHour error:', error);
        return { hour: -1, micro_check_count: 0 };
    }
};

export const getTopTriggerApps = async (daysBack = 7) => {
    if (!db) return [];
    try {
        const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
        const [results] = await db.executeSql(
            `SELECT packageName AS package_name,
                    COUNT(*) AS micro_check_count,
                    AVG(duration) AS avg_duration_ms
             FROM sessions
             WHERE type = 'micro-check' AND startTime >= ?
             GROUP BY packageName
             ORDER BY micro_check_count DESC
             LIMIT 3`,
            [cutoff]
        );
        const apps = [];
        for (let i = 0; i < results.rows.length; i++) {
            apps.push(results.rows.item(i));
        }
        return apps;
    } catch (error) {
        console.error('[PresencePulse DB] getTopTriggerApps error:', error);
        return [];
    }
};

export const getWeeklyScores = async () => {
    if (!db) return [];
    try {
        const [results] = await db.executeSql(
            `SELECT date,
                    presenceScore AS presence_score,
                    microChecks AS micro_check_count,
                    burstEvents AS burst_count
             FROM daily_metrics
             ORDER BY date DESC
             LIMIT 7`
        );
        const scores = [];
        for (let i = 0; i < results.rows.length; i++) {
            scores.push(results.rows.item(i));
        }
        // Return in ascending date order
        return scores.reverse();
    } catch (error) {
        console.error('[PresencePulse DB] getWeeklyScores error:', error);
        return [];
    }
};

export const getImprovementStreak = async () => {
    if (!db) return 0;
    try {
        const [results] = await db.executeSql(
            `SELECT date, presenceScore
             FROM daily_metrics
             ORDER BY date DESC
             LIMIT 30`
        );
        let streak = 0;
        for (let i = 0; i < results.rows.length; i++) {
            if (results.rows.item(i).presenceScore >= 70) {
                streak++;
            } else {
                break;
            }
        }
        return streak;
    } catch (error) {
        console.error('[PresencePulse DB] getImprovementStreak error:', error);
        return 0;
    }
};

// ─── Phase 8: USP Helpers ─────────────────

export const saveFiveSecondEvent = async (event) => {
    if (!db) return;
    try {
        const { timestamp, won, app_opened, is_social_context = 0 } = event;
        await db.executeSql(
            `INSERT INTO five_second_events (timestamp, won, app_opened, is_social_context) VALUES (?, ?, ?, ?)`,
            [timestamp, won ? 1 : 0, app_opened, is_social_context ? 1 : 0]
        );
        console.log(`[PresencePulse DB] Saved 5-second event: ${won ? 'WON' : 'LOST'}`);
    } catch (error) {
        console.error('[PresencePulse DB] Save 5-second event error:', error);
    }
};

export const getFiveSecondStats = async (daysBack = 7) => {
    if (!db) return { won: 0, lost: 0, rate: 0 };
    try {
        const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
        const [results] = await db.executeSql(
            `SELECT 
                COUNT(*) as total,
                SUM(won) as won_count
             FROM five_second_events
             WHERE timestamp >= ?`,
            [cutoff]
        );
        if (results.rows.length > 0) {
            const { total, won_count } = results.rows.item(0);
            const lost = total - won_count;
            const rate = total > 0 ? Math.round((won_count / total) * 100) : 0;
            return { won: won_count || 0, lost: lost || 0, rate };
        }
        return { won: 0, lost: 0, rate: 0 };
    } catch (error) {
        console.error('[PresencePulse DB] Get 5-second stats error:', error);
        return { won: 0, lost: 0, rate: 0 };
    }
};

export const getReflectionBreakdown = async (daysBack = 7) => {
    if (!db) return {};
    try {
        const [results] = await db.executeSql(
            `SELECT trigger_type, COUNT(*) as count
             FROM reflections
             WHERE timestamp > (CAST(strftime('%s', 'now') AS INTEGER) - (? * 24 * 60 * 60)) * 1000
             GROUP BY trigger_type
             ORDER BY count DESC`,
            [daysBack]
        );
        const breakdown = {};
        let total = 0;
        for (let i = 0; i < results.rows.length; i++) {
            const item = results.rows.item(i);
            breakdown[item.trigger_type] = item.count;
            total += item.count;
        }
        // Convert to percentages
        if (total > 0) {
            Object.keys(breakdown).forEach(k => {
                breakdown[k] = Math.round((breakdown[k] / total) * 100);
            });
        }
        return breakdown;
    } catch (error) {
        console.error('[PresencePulse DB] getReflectionBreakdown error:', error);
        return {};
    }
};

export const getWholeWeeklyMetrics = async () => {
    if (!db) return [];
    try {
        const [results] = await db.executeSql(
            `SELECT date, presenceScore as presence_score, phubbing_event_count as phubbing_events
             FROM daily_metrics
             ORDER BY date DESC
             LIMIT 7`
        );
        const metrics = [];
        for (let i = 0; i < results.rows.length; i++) {
            metrics.push(results.rows.item(i));
        }
        return metrics;
    } catch (error) {
        console.error('[PresencePulse DB] getWholeWeeklyMetrics error:', error);
        return [];
    }
};

export const getHourlyHeatStats = async (daysBack = 7) => {
    if (!db) return Array(24).fill(0);
    try {
        const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
        const [results] = await db.executeSql(
            `SELECT 
                CAST(strftime('%H', startTime / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
                SUM(CASE WHEN type = 'micro-check' AND is_social_context = 1 THEN 3 
                         WHEN type = 'burst' THEN 2
                         WHEN type = 'micro-check' THEN 1 ELSE 0 END) as heat_score
             FROM sessions
             WHERE startTime >= ?
             GROUP BY hour`,
            [cutoff]
        );
        const heatMap = Array(24).fill(0);
        for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            heatMap[row.hour] = row.heat_score;
        }
        return heatMap;
    } catch (error) {
        console.error('[PresencePulse DB] getHourlyHeatStats error:', error);
        return Array(24).fill(0);
    }
};

export const getHeatSignatureData = async () => {
    if (!db) return Array(24).fill(null).map((_, i) => ({ hour: i, micro_check_count: 0, phubbing_count: 0, burst_count: 0 }));
    try {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const [results] = await db.executeSql(
            `SELECT 
                CAST(strftime('%H', startTime / 1000, 'unixepoch', 'localtime') AS INTEGER) as hour,
                COUNT(CASE WHEN type = 'micro-check' THEN 1 END) as micro_check_count,
                COUNT(CASE WHEN type = 'micro-check' AND is_social_context = 1 THEN 1 END) as phubbing_count,
                COUNT(CASE WHEN type = 'burst' THEN 1 END) as burst_count
             FROM sessions
             WHERE startTime > ?
             GROUP BY hour`,
            [sevenDaysAgo]
        );

        const dataGrid = Array(24).fill(null).map((_, i) => ({
            hour: i,
            micro_check_count: 0,
            phubbing_count: 0,
            burst_count: 0
        }));

        for (let i = 0; i < results.rows.length; i++) {
            const row = results.rows.item(i);
            if (row.hour >= 0 && row.hour < 24) {
                dataGrid[row.hour] = {
                    hour: row.hour,
                    micro_check_count: row.micro_check_count,
                    phubbing_count: row.phubbing_count,
                    burst_count: row.burst_count
                };
            }
        }
        return dataGrid;
    } catch (error) {
        console.error('[PresencePulse DB] Get heat signature error:', error);
        return Array(24).fill(null).map((_, i) => ({ hour: i, micro_check_count: 0, phubbing_count: 0, burst_count: 0 }));
    }
};

export const seedReflectionData = async () => {
    if (!db) return;
    try {
        const now = Date.now();
        const demoData = [
            { type: 'Boredom', count: 12 },
            { type: 'Anxiety', count: 4 },
            { type: 'Pure habit', count: 15 },
            { type: 'Notification', count: 5 },
            { type: 'Curiosity', count: 3 }
        ];

        for (const item of demoData) {
            for (let i = 0; i < item.count; i++) {
                const randomTime = now - (Math.random() * 3 * 24 * 60 * 60 * 1000);
                await db.executeSql(
                    `INSERT INTO reflections (timestamp, trigger_type) VALUES (?, ?)`,
                    [randomTime, item.type]
                );
            }
        }
        console.log('[PresencePulse DB] Seeded reflection data successfully!');
    } catch (error) {
        console.error('[PresencePulse DB] Seeding error:', error);
    }
};
