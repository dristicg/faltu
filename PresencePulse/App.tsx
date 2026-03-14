import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import {
  getBurstCount,
  getDriftSeverity,
  getDriftThreshold,
  getMicroCheckCount,
  getPresenceScore,
  getScoreCategory,
  setDriftThreshold,
  startSession,
  endSession,
  analyzeUsageEvents,
  resetBurstState
} from './src/services/contextEngine';
import {
  checkUsageAccessPermission,
  getRecentUsageEvents,
  openUsageAccessSettings,
  listenForUnlockEvents,
} from './src/services/usageTrackingService';
import { initDatabase, getDailyMetrics, getCachedInsight, saveInsight, getVulnerableHour, getTopTriggerApps, getWeeklyScores, getImprovementStreak } from './src/database/databaseService';
import { initializeStateFromStorage, registerScreenUnlock } from './src/services/contextEngine';
import { checkSocialContext } from './src/services/bluetoothProximityService';
import { analyzePatterns } from './src/engine/patternAnalyzer';
import { fetchDailyInsight } from './src/services/llmService';
import { generateDailyInsight } from './src/services/aiInsightService';
import { getCurrentNudgeTier, resetNudgeTier } from './src/engine/nudgeEngine';
import TimelineScreen from './src/screens/TimelineScreen';
import ReconnectScreen from './src/screens/ReconnectScreen';
import ReflectionModal from './src/components/ReflectionModal';
import WeeklyHeatmap from './src/components/WeeklyHeatmap';

function App() {
  return (
    <>
      <StatusBar barStyle="light-content" />
      <ScreenManager />
    </>
  );
}

type ScoreVisual = {
  accent: string;
  surface: string;
};

type SensitivityMode = 'Strict' | 'Normal' | 'Relaxed';

const SCORE_VISUALS: Record<string, ScoreVisual> = {
  High: { accent: '#22C55E', surface: '#102A1A' },
  Medium: { accent: '#EAB308', surface: '#2A1F0A' },
  Low: { accent: '#EF4444', surface: '#2F0F11' },
};

const SENSITIVITY_OPTIONS: Array<{
  mode: SensitivityMode;
  title: string;
  description: string;
}> = [
    { mode: 'Strict', title: 'Strict Mode', description: '3 micro-check threshold' },
    { mode: 'Normal', title: 'Normal Mode', description: '5 micro-check threshold' },
    { mode: 'Relaxed', title: 'Relaxed Mode', description: '7 micro-check threshold' },
  ];

function resolveScoreVisual(category: string): ScoreVisual {
  return SCORE_VISUALS[category] ?? SCORE_VISUALS.Low;
}

function resolveModeFromThreshold(threshold: number): SensitivityMode {
  if (threshold <= 3) {
    return 'Strict';
  }

  if (threshold >= 7) {
    return 'Relaxed';
  }

  return 'Normal';
}

function ScreenManager() {
  const [screen, setScreen] = useState<
    'home' | 'social' | 'drift' | 'reconnect' | 'insights' | 'timeline' | 'settings'
  >('home');
  const [socialContext, setSocialContext] = useState(false);
  const socialContextRef = useRef(false);
  const lastBleCheck = useRef(0);
  const [microChecks, setMicroChecks] = useState(0);
  const [burstEvents, setBurstEvents] = useState(0);
  const [presenceScore, setPresenceScore] = useState(100);
  const [scoreCategory, setScoreCategory] = useState('High');
  const [severity, setSeverity] = useState('None');
  const [sensitivityMode, setSensitivityMode] = useState<SensitivityMode>('Normal');
  const [topTrigger, setTopTrigger] = useState('Unknown');
  const [vulnerableHour, setVulnerableHour] = useState(-1);
  const [dailyInsight, setDailyInsight] = useState('Fetching your personalized coaching tip...');
  const [weeklyScores, setWeeklyScores] = useState<any[]>([]);
  const [triggerApps, setTriggerApps] = useState<any[]>([]);
  const [improvementStreak, setImprovementStreak] = useState(0);
  const [vulnerableHourData, setVulnerableHourData] = useState<{hour: number, micro_check_count: number}>({hour: -1, micro_check_count: 0});

  const refreshMetrics = () => {
    setMicroChecks(getMicroCheckCount());
    setBurstEvents(getBurstCount());
    const latestScore = getPresenceScore();
    setPresenceScore(latestScore);
    setScoreCategory(getScoreCategory());

    const nudgeTier = getCurrentNudgeTier();
    if (nudgeTier >= 2) {
      setScreen(prev => {
        if (nudgeTier === 3 && prev !== 'reconnect') return 'reconnect';
        if (nudgeTier === 2 && prev !== 'drift' && prev !== 'reconnect') return 'drift';
        return prev;
      });
      resetNudgeTier();
    }
  };

  const loadOrGenerateDailyInsight = async () => {
    const today = new Date().toISOString().split('T')[0];
    const cached = await getCachedInsight(today);

    if (cached) {
      setDailyInsight(cached.insight_text);
      return;
    }

    const hour = new Date().getHours();
    if (hour < 6) return;

    const metrics = await getDailyMetrics();
    const patterns = await analyzePatterns();

    const insight = await generateDailyInsight(metrics, patterns);
    await saveInsight(today, insight);
    setDailyInsight(insight);
  };

  useEffect(() => {
    if (screen === 'insights') {
      console.log('---- INSIGHTS REFRESH ----');
      console.log('Micro:', getMicroCheckCount());
      console.log('Burst:', getBurstCount());
      console.log('Score:', getPresenceScore());
      analyzePatterns().then((result) => {
        setTopTrigger(result.topTrigger);
        setVulnerableHour(result.vulnerableHour);
      });
      loadOrGenerateDailyInsight();

      // Phase 7: Fetch pattern intelligence data
      getWeeklyScores().then(setWeeklyScores);
      getVulnerableHour().then(setVulnerableHourData);
      getTopTriggerApps().then(setTriggerApps);
      getImprovementStreak().then(setImprovementStreak);
    }

    if (screen === 'home' || screen === 'insights') {
      refreshMetrics();
    }

    if (screen === 'insights' || screen === 'drift') {
      setSeverity(getDriftSeverity());
    }
  }, [screen]);

  useEffect(() => {
    setSensitivityMode(resolveModeFromThreshold(getDriftThreshold()));
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const startPolling = async () => {
      const hasPermission = await checkUsageAccessPermission();
      if (!hasPermission) {
        console.log('App Usage Permission not granted, skipping polling.');
        return;
      }

      intervalId = setInterval(async () => {
        if (Date.now() - lastBleCheck.current > 60000) {
          lastBleCheck.current = Date.now();
          const bleResult = await checkSocialContext();
          socialContextRef.current = bleResult.isSocialContext;
          setSocialContext(bleResult.isSocialContext);
        }

        const events = await getRecentUsageEvents();
        if (events && events.length > 0) {
          analyzeUsageEvents(events, socialContextRef.current);
          refreshMetrics();
        }
      }, 5000);
    };

    const initializeSequence = async () => {
      await initDatabase();

      // Phase 2: Restore behavioral status from SQLite
      const todayMetrics = await getDailyMetrics();
      initializeStateFromStorage(todayMetrics);
      refreshMetrics();

      startPolling();

      const unlockSubscription = listenForUnlockEvents((timestamp: number) => {
        registerScreenUnlock(timestamp);
      });

      return () => {
        if (unlockSubscription) unlockSubscription.remove();
      }
    };

    let cleanup = () => { };
    initializeSequence().then(clean => {
      if (clean) cleanup = clean;
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      cleanup();
    };
  }, []);

  const handleModeSelect = (mode: SensitivityMode) => {
    setDriftThreshold(mode);
    setSensitivityMode(mode);
    refreshMetrics();
    setScreen('home');
  };

  const testUsage = async () => {
    const events = await getRecentUsageEvents();
    console.log("Usage Events:", events);
  };

  const scoreVisual = resolveScoreVisual(scoreCategory);
  const scoreAccentColor = scoreVisual.accent;

  const renderHome = () => (
    <>
      <ScrollView contentContainerStyle={styles.homeScrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerBlock}>
            <Text style={styles.appName}>Presence Pulse</Text>
            <Text style={styles.tagline}>Detect. Reflect. Reconnect.</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setScreen('settings')}
          >
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.presenceCard, { borderColor: scoreAccentColor }]}>
          <Text style={styles.presenceLabel}>Presence Score</Text>
          <View style={[styles.scoreCircle, { borderColor: scoreAccentColor }]}>
            <Text style={[styles.scoreValue, { color: scoreAccentColor }]}>
              {presenceScore}%
            </Text>
          </View>
          <View
            style={[
              styles.scoreCategoryTag,
              {
                backgroundColor: scoreVisual.surface,
                borderColor: scoreAccentColor,
              },
            ]}
          >
            <Text
              style={[styles.scoreCategoryTagText, { color: scoreAccentColor }]}
            >
              {scoreCategory} Focus
            </Text>
          </View>
          <Text style={styles.presenceSubtitle}>Your Current Presence Score</Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard label="Micro-checks Today" value={String(microChecks)} />
          <MetricCard label="Burst Events" value={String(burstEvents)} />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, styles.homeButton]}
          onPress={() => {
            startSession();
            setScreen('social');
          }}
        >
          <Text style={styles.primaryButtonText}>Start Social Mode</Text>
        </TouchableOpacity>

        <View style={{ marginTop: 16 }}>
          <Button title="Test Usage Events" onPress={testUsage} />
        </View>
      </ScrollView>

      {/* TIER 2 INTERVENTION - Global Reflection Modal */}
      <ReflectionModal
        visible={getCurrentNudgeTier() === 2}
        onClose={() => {
          resetNudgeTier();
          refreshMetrics();
        }}
      />
    </>
  );

  const renderSocial = () => (
    <View style={styles.centeredBlock}>
      <Text style={styles.title}>Social Mode Active</Text>
      <Text style={styles.subtitle}>Tracking your attention...</Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => {
          endSession();
          refreshMetrics();
          setScreen('drift');
        }}
      >
        <Text style={styles.primaryButtonText}>End Session</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDrift = () => (
    <View style={styles.centeredBlock}>
      <Text style={styles.warning}>⚠ Attention Drift Detected</Text>
      <Text style={styles.severityLabel}>Drift Level: {severity}</Text>
      <Text style={styles.subtitle}>
        You've had multiple micro-check bursts in the last 10 minutes.
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setScreen('reconnect')}
      >
        <Text style={styles.primaryButtonText}>Return to Focus</Text>
      </TouchableOpacity>
    </View>
  );

  const formatHourLabel = (hour: number): string => {
    if (hour < 0) return '--';
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${suffix}`;
  };

  const mapAppDisplayName = (pkg: string): string => {
    const APP_NAMES: Record<string, string> = {
      'com.instagram.android': 'Instagram',
      'com.whatsapp': 'WhatsApp',
      'com.google.android.youtube': 'YouTube',
      'com.facebook.katana': 'Facebook',
      'com.reddit.frontpage': 'Reddit',
      'com.snapchat.android': 'Snapchat',
      'com.linkedin.android': 'LinkedIn',
    };
    if (APP_NAMES[pkg]) return APP_NAMES[pkg];
    if (!pkg) return 'Unknown';
    const parts = pkg.split('.');
    return parts[parts.length - 1] || pkg;
  };

  const renderInsights = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Your Attention Insights</Text>

      {/* Phase 7: Weekly Presence Heatmap */}
      <WeeklyHeatmap scores={weeklyScores} />

      <View style={styles.cardGroup}>
        <InsightCard
          label="Micro-checks Today"
          value={String(microChecks)}
        />
        <InsightCard
          label="Burst Events"
          value={String(burstEvents)}
        />
        <InsightCard
          label="Presence Score"
          value={`${presenceScore}%`}
          emphasize
          accentColor={scoreAccentColor}
          detail={`${scoreCategory} Focus`}
        />
        <InsightCard
          label="Top Phubbing Trigger"
          value={topTrigger !== 'Unknown' ? topTrigger : '--'}
          detail={vulnerableHour !== -1 ? `Peak at ${vulnerableHour}:00` : ''}
        />
      </View>

      {/* Phase 7: Pattern Intelligence Cards */}
      <View style={styles.patternSection}>
        <View style={styles.patternCard}>
          <Text style={styles.patternCardIcon}>🕐</Text>
          <Text style={styles.patternCardLabel}>Most Vulnerable Hour</Text>
          <Text style={styles.patternCardValue}>
            {vulnerableHourData.hour >= 0
              ? formatHourLabel(vulnerableHourData.hour)
              : 'Not enough data'}
          </Text>
          {vulnerableHourData.micro_check_count > 0 && (
            <Text style={styles.patternCardDetail}>
              {vulnerableHourData.micro_check_count} micro-checks this week
            </Text>
          )}
        </View>

        <View style={styles.patternCard}>
          <Text style={styles.patternCardIcon}>📱</Text>
          <Text style={styles.patternCardLabel}>Top Trigger Apps</Text>
          {triggerApps.length > 0 ? (
            triggerApps.map((app, idx) => (
              <Text key={idx} style={styles.patternAppItem}>
                {idx + 1}. {mapAppDisplayName(app.package_name)}
              </Text>
            ))
          ) : (
            <Text style={styles.patternCardValue}>No triggers yet</Text>
          )}
        </View>

        <View style={styles.patternCard}>
          <Text style={styles.patternCardIcon}>🔥</Text>
          <Text style={styles.patternCardLabel}>Improvement Streak</Text>
          <Text style={styles.patternCardValue}>
            {improvementStreak > 0
              ? `${improvementStreak} day${improvementStreak !== 1 ? 's' : ''}`
              : 'Start today!'}
          </Text>
          {improvementStreak > 0 && (
            <Text style={styles.patternCardDetail}>Consecutive days ≥ 70 score</Text>
          )}
        </View>
      </View>

      <View style={styles.insightBox}>
        <Text style={styles.insightBoxLabel}>✨ AI COACHING INSIGHT</Text>
        <Text style={styles.insightBoxText}>{dailyInsight}</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, styles.fullWidthButton]}
        onPress={() => setScreen('timeline')}
      >
        <Text style={styles.primaryButtonText}>View Attention Timeline</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.testButton} onPress={testUsage}>
        <Text style={styles.testButtonText}>Test Data Pull</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setScreen('home')}
      >
        <Text style={styles.secondaryButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTimeline = () => (
    <TimelineScreen onBack={() => {
      refreshMetrics();
      setScreen('home');
    }} />
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Sensitivity Settings</Text>
      <View style={styles.settingsGroup}>
        <TouchableOpacity
          style={[styles.settingOption, { marginBottom: 16 }]}
          onPress={openUsageAccessSettings}
        >
          <Text style={styles.settingOptionTitle}>App Usage Permission</Text>
          <Text style={styles.settingOptionSubtitle}>Open Android settings to grant usage tracking access</Text>
        </TouchableOpacity>

        {SENSITIVITY_OPTIONS.map((option) => {
          const selected = option.mode === sensitivityMode;
          return (
            <TouchableOpacity
              key={option.mode}
              style={[
                styles.settingOption,
                selected && styles.settingOptionSelected,
              ]}
              onPress={() => handleModeSelect(option.mode)}
            >
              <Text
                style={[
                  styles.settingOptionTitle,
                  selected && styles.settingOptionTitleSelected,
                ]}
              >
                {option.title}
              </Text>
              <Text style={styles.settingOptionSubtitle}>
                {option.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setScreen('home')}
      >
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderReconnect = () => (
    <ReconnectScreen
      burstCount={getBurstCount()}
      onComplete={() => {
        resetNudgeTier();
        resetBurstState();
        refreshMetrics();
        setScreen('home');
      }}
      onSkip={() => {
        resetNudgeTier();
        refreshMetrics();
        setScreen('home');
      }}
    />
  );

  const renderScreen = () => {
    switch (screen) {
      case 'social':
        return renderSocial();
      case 'drift':
        return renderDrift();
      case 'reconnect':
        return renderReconnect();
      case 'insights':
        return renderInsights();
      case 'timeline':
        return renderTimeline();
      case 'settings':
        return renderSettings();
      case 'home':
      default:
        return renderHome();
    }
  };

  const showBottomNav = !['social', 'drift', 'reconnect'].includes(screen);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContent}>{renderScreen()}</View>
      {showBottomNav && (
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navTab, screen === 'home' && styles.navTabActive]}
            onPress={() => setScreen('home')}
          >
            <Text style={[styles.navTabIcon, screen === 'home' && styles.navTabIconActive]}>🏠</Text>
            <Text style={[styles.navTabLabel, screen === 'home' && styles.navTabLabelActive]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navTab, screen === 'insights' && styles.navTabActive]}
            onPress={() => setScreen('insights')}
          >
            <Text style={[styles.navTabIcon, screen === 'insights' && styles.navTabIconActive]}>📊</Text>
            <Text style={[styles.navTabLabel, screen === 'insights' && styles.navTabLabelActive]}>Insights</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navTab, screen === 'timeline' && styles.navTabActive]}
            onPress={() => setScreen('timeline')}
          >
            <Text style={[styles.navTabIcon, screen === 'timeline' && styles.navTabIconActive]}>📅</Text>
            <Text style={[styles.navTabLabel, screen === 'timeline' && styles.navTabLabelActive]}>Timeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navTab, screen === 'settings' && styles.navTabActive]}
            onPress={() => setScreen('settings')}
          >
            <Text style={[styles.navTabIcon, screen === 'settings' && styles.navTabIconActive]}>⚙️</Text>
            <Text style={[styles.navTabLabel, screen === 'settings' && styles.navTabLabelActive]}>Settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function InsightCard({
  label,
  value,
  emphasize = false,
  accentColor,
  detail,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  accentColor?: string;
  detail?: string;
}) {
  return (
    <View
      style={[styles.card, accentColor ? { borderColor: accentColor } : null]}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      <Text
        style={[
          emphasize ? styles.cardValueLarge : styles.cardValue,
          accentColor ? { color: accentColor } : null,
        ]}
      >
        {value}
      </Text>
      {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function SuggestionCard({ label }: { label: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardValue}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centeredBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 32,
    alignItems: 'center',
  },
  homeScrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  title: {
    fontSize: 30,
    color: '#F1F5F9',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  fullWidthButton: {
    width: '100%',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  warning: {
    fontSize: 22,
    color: '#F87171',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  severityLabel: {
    fontSize: 18,
    color: '#FBBF24',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardGroup: {
    width: '100%',
    gap: 24,
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2F3B53',
  },
  cardLabel: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardValue: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: '700',
  },
  cardValueLarge: {
    color: '#F1F5F9',
    fontSize: 34,
    fontWeight: '800',
  },
  cardDetail: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  insightBox: {
    width: '100%',
    backgroundColor: '#1C2B4B',
    padding: 18,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#60A5FA',
    marginBottom: 24,
  },
  insightBoxLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  insightBoxText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    marginTop: 16,
  },
  secondaryButtonText: {
    color: '#CBD5F5',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timeline: {
    width: '100%',
    gap: 12,
    marginVertical: 24,
  },
  timelineItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111C2F',
  },
  timelineItemHighlight: {
    borderColor: '#F87171',
  },
  timelineTime: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 4,
  },
  timelineEvent: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '600',
  },
  homeWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerBlock: {
    gap: 8,
    flex: 1,
  },
  settingsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2B40',
    backgroundColor: '#132038',
  },
  settingsButtonText: {
    color: '#60A5FA',
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  appName: {
    fontSize: 34,
    color: '#F8FAFC',
    fontWeight: '800',
  },
  presenceCard: {
    backgroundColor: '#111C2F',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  presenceLabel: {
    color: '#94A3B8',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 8,
    borderColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreValue: {
    color: '#F8FAFC',
    fontSize: 42,
    fontWeight: '800',
  },
  presenceSubtitle: {
    color: '#CBD5F5',
    fontSize: 14,
    textAlign: 'center',
  },
  scoreCategoryTag: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  scoreCategoryTagText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222F44',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 13,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
  },
  settingsGroup: {
    width: '100%',
    gap: 16,
    marginVertical: 32,
  },
  settingOption: {
    backgroundColor: '#17233A',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1F2B40',
  },
  settingOptionSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#13213A',
  },
  settingOptionTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  settingOptionTitleSelected: {
    color: '#60A5FA',
  },
  settingOptionSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
  },
  homeButton: {
    marginTop: 24,
  },
  testButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  testButtonText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#2F3B53',
    paddingBottom: 4,
    paddingTop: 8,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  navTabActive: {
    borderTopWidth: 2,
    borderTopColor: '#3B82F6',
  },
  navTabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navTabIconActive: {
    opacity: 1,
  },
  navTabLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  navTabLabelActive: {
    color: '#60A5FA',
  },
  patternSection: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  patternCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2F3B53',
  },
  patternCardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  patternCardLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  patternCardValue: {
    color: '#F1F5F9',
    fontSize: 20,
    fontWeight: '700',
  },
  patternCardDetail: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  patternAppItem: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default App;
