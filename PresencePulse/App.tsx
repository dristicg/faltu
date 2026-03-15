import React, { useEffect, useState, useRef } from 'react';
import {
  Button,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  resetBurstState,
  getWinRate5s
} from './src/services/contextEngine';
import {
  checkUsageAccessPermission,
  getRecentUsageEvents,
  openUsageAccessSettings,
  listenForUnlockEvents,
} from './src/services/usageTrackingService';
import { initDatabase, getDailyMetrics, getCachedInsight, saveInsight, getVulnerableHour, getTopTriggerApps, getWeeklyScores, getImprovementStreak, getHourlyHeatStats, getReflectionBreakdown, getFiveSecondStats, getWholeWeeklyMetrics, getLastSessionTimestamp, recalculateTodayMetrics } from './src/database/databaseService';
import { initializeStateFromStorage, registerScreenUnlock } from './src/services/contextEngine';
import { checkSocialContext } from './src/services/bluetoothProximityService';
import { analyzePatterns } from './src/engine/patternAnalyzer';
import { fetchDailyInsight, generateBehavioralBlueprint } from './src/services/llmService';
import { getCurrentNudgeTier, resetNudgeTier } from './src/engine/nudgeEngine';
import { isZenMode, toggleZenMode } from './src/services/zenService';
import TimelineScreen from './src/screens/TimelineScreen';
import ReconnectScreen from './src/screens/ReconnectScreen';
import ReflectionModal from './src/components/ReflectionModal';
import WeeklyHeatmap from './src/components/WeeklyHeatmap';
import InsightsScreen from './src/screens/InsightsScreen';
import CoachScreen from './src/screens/CoachScreen';
import { calculatePresenceDebt, getPresenceDebt } from './src/services/contextEngine';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScreenManager />
    </SafeAreaProvider>
  );
}

type ScoreVisual = {
  accent: string;
  surface: string;
};

type SensitivityMode = 'Strict' | 'Normal' | 'Relaxed';

const SCORE_VISUALS: Record<string, ScoreVisual> = {
  High: { accent: '#00FFA3', surface: '#002B1B' },
  Medium: { accent: '#FFDF00', surface: '#332D00' },
  Low: { accent: '#FF3366', surface: '#330014' },
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
    'home' | 'social' | 'drift' | 'reconnect' | 'insights' | 'timeline' | 'settings' | 'coach'
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
  const [zenActive, setZenActive] = useState(false);
  const [blueprint, setBlueprint] = useState<any>(null);
  const [heatMap, setHeatMap] = useState<number[]>(Array(24).fill(0));
  const [reflectionBreakdown, setReflectionBreakdown] = useState<any>({});
  const [fiveSecondStats, setFiveSecondStats] = useState<any>({ won: 0, lost: 0, rate: 0 });
  const [presenceDebt, setPresenceDebt] = useState(0);
  const [checkInDone, setCheckInDone] = useState(false);
  const [checkInResponse, setCheckInResponse] = useState('');

  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        })
      ])
    ).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

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
    setPresenceDebt(getPresenceDebt());
    setFiveSecondStats((prev: any) => ({ ...prev, rate: getWinRate5s() }));
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

    // Use Gemini 1.5 Pro Behavioral Blueprint
    try {
      const bp = await generateBehavioralBlueprint();
      setBlueprint(bp);
      const insight = bp.coachingInsight || 'Keep tracking to build your behavioral profile.';
      await saveInsight(today, insight);
      setDailyInsight(insight);
    } catch (e) {
      console.warn('[App] Blueprint generation failed, using fallback:', e);
      const insight = await fetchDailyInsight();
      await saveInsight(today, insight);
      setDailyInsight(insight);
    }
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
      }).catch(e => console.warn('[Insights] analyzePatterns error:', e));
      loadOrGenerateDailyInsight().catch(e => console.warn('[Insights] dailyInsight error:', e));

      // Phase 7: Fetch pattern intelligence data
      getWeeklyScores().then(setWeeklyScores).catch(e => console.warn('[Phase7] weeklyScores error:', e));
      getVulnerableHour().then(setVulnerableHourData).catch(e => console.warn('[Phase7] vulnerableHour error:', e));
      getTopTriggerApps().then(setTriggerApps).catch(e => console.warn('[Phase7] triggerApps error:', e));
      getImprovementStreak().then(setImprovementStreak).catch(e => console.warn('[Phase7] streak error:', e));
      
      // Phase 8: Fetch USP data
      getHourlyHeatStats().then(setHeatMap).catch(e => console.warn('[USP] heatMap error:', e));
      getReflectionBreakdown().then(setReflectionBreakdown).catch(e => console.warn('[USP] reflection error:', e));
      getFiveSecondStats().then(setFiveSecondStats).catch(e => console.warn('[USP] fiveSecond error:', e));
      getWholeWeeklyMetrics().then(metrics => {
          const debt = calculatePresenceDebt(metrics);
          setPresenceDebt(debt);
      }).catch(e => console.warn('[USP] debt error:', e));
    }

    if (screen === 'home' || screen === 'insights') {
      // Only update metrics display — don't redirect from nudge tiers during tab navigation
      setMicroChecks(getMicroCheckCount());
      setBurstEvents(getBurstCount());
      setPresenceScore(getPresenceScore());
      setScoreCategory(getScoreCategory());
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
      const lastTimestamp = await getLastSessionTimestamp();
      
      // USP: Recalculate true counts from sessions (De-corruption)
      const verifiedMetrics = await recalculateTodayMetrics();
      
      if (todayMetrics) {
        setCheckInDone(!!todayMetrics.checkin_done);
        setCheckInResponse(todayMetrics.checkin_response || '');
      }
      initializeStateFromStorage(verifiedMetrics, lastTimestamp);
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
    <ScrollView contentContainerStyle={styles.homeScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={styles.headerBlock}>
          <Text style={styles.appName}>Presence Pulse</Text>
          <Text style={styles.tagline}>Detect. Reflect. Reconnect.</Text>
        </View>

        <TouchableOpacity
          style={[styles.zenButton, zenActive && styles.zenButtonActive]}
          onPress={() => {
            const newState = toggleZenMode();
            setZenActive(newState);
          }}
        >
          <Text style={styles.zenButtonText}>{zenActive ? '🌙 Zen On' : '☀️ Track'}</Text>
        </TouchableOpacity>
      </View>

      {zenActive && (
        <View style={styles.zenBanner}>
          <Text style={styles.zenBannerText}>🧘 Zen Mode — Tracking paused</Text>
        </View>
      )}

      {/* Flagship USP 4: Coach Entry Point (Prominent Position) */}
      <TouchableOpacity 
        style={styles.coachCard} 
        onPress={() => setScreen('coach')}
      >
        <View style={styles.coachCardHeader}>
            <Text style={styles.coachCardTitle}>✨ Digital Coach Sanctuary</Text>
            {checkInDone && <Text style={styles.doneBadge}>DONE</Text>}
        </View>
        <Text style={styles.coachCardText}>
            {checkInDone 
                ? "Daily check-in complete. Your sanctuary is always open." 
                : "Good Morning. How are you feeling about your focus today?"}
        </Text>
        <Text style={styles.coachCardAction}>
            {checkInDone ? "Continue Reflection ›" : "Start Conversational Check-in ›"}
        </Text>
      </TouchableOpacity>

      <Animated.View style={[styles.presenceCard, { borderColor: scoreAccentColor, opacity: fadeAnim, marginTop: 20 }]}>
        <Text style={styles.presenceLabel}>Presence Score</Text>
        <Animated.View style={[styles.scoreCircle, { borderColor: scoreAccentColor, transform: [{ scale: pulseAnim }], shadowColor: scoreAccentColor, elevation: 12 }]}>
          <Text style={[styles.scoreValue, { color: scoreAccentColor }]}>
            {presenceScore}%
          </Text>
        </Animated.View>
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
        
        {/* Presence Debt Indicator */}
        <View style={styles.debtContainer}>
            <Text style={[styles.debtLabel, { color: presenceDebt > 70 ? '#EF4444' : presenceDebt > 30 ? '#F59E0B' : presenceDebt > 0 ? '#FBBF24' : '#10B981' }]}>
                Presence Debt: <Text style={styles.debtValue}>{presenceDebt}</Text>
            </Text>
            <Text style={styles.debtStatus}>
                {presenceDebt === 0 ? '💚 Fully present this week' : 
                 presenceDebt <= 30 ? '💛 Presence debt: recovering' : 
                 presenceDebt <= 70 ? '🟠 You have missed some moments' : 
                 '🔴 High presence debt — start fresh tomorrow'}
            </Text>
        </View>
      </Animated.View>

      <View style={[styles.metricsRow, { marginTop: 24 }]}>
        <MetricCard label="Micro-checks Today" value={String(microChecks)} />
        <MetricCard label="Burst Events" value={String(burstEvents)} />
      </View>

      <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.homeButton, {flex: 1}]}
            onPress={() => {
              startSession();
              setScreen('social');
            }}
          >
            <Text style={styles.primaryButtonText}>Social Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.insightsTrigger}
            onPress={() => setScreen('insights')}
          >
            <Text style={styles.insightsTriggerText}>Insights</Text>
          </TouchableOpacity>
      </View>
    </ScrollView>
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
    <InsightsScreen
      onBack={() => setScreen('home')}
      weeklyScores={weeklyScores}
      microChecks={microChecks}
      burstEvents={burstEvents}
      presenceScore={presenceScore}
      scoreCategory={scoreCategory}
      scoreAccentColor={resolveScoreVisual(scoreCategory).accent}
      topTrigger={topTrigger}
      vulnerableHour={vulnerableHour}
      triggerApps={triggerApps}
      improvementStreak={improvementStreak}
      vulnerableHourData={vulnerableHourData}
      dailyInsight={dailyInsight}
      blueprint={blueprint}
      heatMap={heatMap}
      reflectionBreakdown={reflectionBreakdown}
      fiveSecondStats={fiveSecondStats}
      onTimelinePress={() => setScreen('timeline')}
      onTestUsage={testUsage}
    />
  );


  const renderTimeline = () => (
    <TimelineScreen onBack={() => {
      refreshMetrics();
      setScreen('home');
    }} />
  );

  const renderCoach = () => (
    <CoachScreen
      onBack={() => setScreen('home')}
      microChecks={microChecks}
      score={presenceScore}
      checkInDone={checkInDone}
      checkInResponse={checkInResponse}
      onCheckInComplete={(response: string) => {
          const { updateCheckInStatus } = require('./src/database/databaseService');
          updateCheckInStatus(true, response);
          setCheckInDone(true);
          setCheckInResponse(response);
      }}
    />
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
      case 'coach':
        return renderCoach();
      case 'home':
      default:
        return renderHome();
    }
  };

  const showBottomNav = !['social', 'drift', 'reconnect'].includes(screen);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.screenContent}>{renderScreen()}</View>

      {/* Global Reflection Modal — rendered outside screen content */}
      <ReflectionModal
        visible={getCurrentNudgeTier() === 2}
        onClose={() => {
          resetNudgeTier();
          refreshMetrics();
        }}
      />

      {showBottomNav && (
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom || 16 }]}>
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
    </View>
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
    <Animated.View
      style={[styles.card, accentColor ? { borderColor: accentColor, shadowColor: accentColor, elevation: 8 } : null]}
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
    </Animated.View>
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
    backgroundColor: '#09090B', // Deep black modern background
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
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: '#7C3AED', // Vibrant modern purple
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 20, // More rounded GenZ style
    shadowColor: '#7C3AED',
    elevation: 10,
  },
  fullWidthButton: {
    width: '100%',
    marginBottom: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  warning: {
    fontSize: 24,
    color: '#EF4444',
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: '#EF4444',
    textShadowRadius: 10,
  },
  severityLabel: {
    fontSize: 18,
    color: '#FBBF24',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardGroup: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)', // Translucent glass feel
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  cardValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardValueLarge: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },
  cardDetail: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  insightBox: {
    width: '100%',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 24,
  },
  insightBoxLabel: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  insightBoxText: {
    color: '#E2E8F0',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3F3F46',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  secondaryButtonText: {
    color: '#E4E4E7',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeline: {
    width: '100%',
    gap: 16,
    marginVertical: 24,
  },
  timelineItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(24, 24, 27, 0.8)',
  },
  timelineItemHighlight: {
    borderColor: '#F43F5E',
    shadowColor: '#F43F5E',
    elevation: 5,
  },
  timelineTime: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  timelineEvent: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
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
    fontSize: 38,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: -1,
  },
  presenceCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    borderRadius: 40,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
  },
  presenceLabel: {
    color: '#A1A1AA',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '800',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#09090B',
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },
  presenceSubtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreCategoryTag: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scoreCategoryTagText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  metricLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
    fontWeight: '700',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  settingsGroup: {
    width: '100%',
    gap: 16,
    marginVertical: 32,
  },
  settingOption: {
    backgroundColor: 'rgba(24, 24, 27, 0.5)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  settingOptionSelected: {
    borderColor: '#7C3AED',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
  },
  settingOptionTitle: {
    color: '#E4E4E7',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  settingOptionTitleSelected: {
    color: '#A855F7',
  },
  settingOptionSubtitle: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  homeButton: {
    marginTop: 24,
  },
  zenButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2B40',
    backgroundColor: '#132038',
  },
  zenButtonActive: {
    backgroundColor: '#1A1A3E',
    borderColor: '#7C3AED',
  },
  zenButtonText: {
    color: '#A78BFA',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  zenBanner: {
    backgroundColor: '#1A1A3E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7C3AED',
    marginBottom: 12,
    alignItems: 'center' as const,
  },
  zenBannerText: {
    color: '#C4B5FD',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  testButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
  },
  testButtonText: {
    color: '#71717A',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(9, 9, 11, 0.95)', // Translucent dark
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 12,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navTabActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.15)', // Neon purple glow background
    borderRadius: 16,
    marginHorizontal: 8,
  },
  navTabIcon: {
    fontSize: 22,
    marginBottom: 4,
    opacity: 0.5,
  },
  navTabIconActive: {
    opacity: 1,
  },
  navTabLabel: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  navTabLabelActive: {
    color: '#A855F7',
  },
  patternSection: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  patternCard: {
    backgroundColor: 'rgba(24, 24, 27, 0.7)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  patternCardIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  patternCardLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  patternCardValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  patternCardDetail: {
    color: '#71717A',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  patternAppItem: {
    color: '#E4E4E7',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  debtContainer: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  debtLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  debtValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  debtStatus: {
    fontSize: 13,
    color: '#D4D4D8',
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  coachCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#4338CA',
    shadowColor: '#4338CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  coachCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coachCardTitle: {
    color: '#A5B4FC',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  doneBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    color: '#10B981',
    fontSize: 10,
    fontWeight: '900',
  },
  coachCardText: {
    color: '#E0E7FF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 12,
  },
  coachCardAction: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  insightsTrigger: {
    backgroundColor: '#18181B',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3F3F46',
    justifyContent: 'center',
  },
  insightsTriggerText: {
    color: '#D4D4D8',
    fontWeight: '800',
    fontSize: 14,
    textTransform: 'uppercase',
  },
});

export default App;
