import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import WeeklyHeatmap from '../components/WeeklyHeatmap';
import PhubbingHeatSignature from '../components/PhubbingHeatSignature';
import MorningCheckIn from '../components/MorningCheckIn';
import TriggerFingerprint from '../components/TriggerFingerprint';

const formatHourLabel = (hour) => {
  if (hour < 0) return '--';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
};

const mapAppDisplayName = (pkg) => {
  const APP_NAMES = {
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

const InsightsScreen = ({ 
  onBack, 
  weeklyScores, 
  microChecks, 
  burstEvents, 
  presenceScore,
  scoreCategory,
  scoreAccentColor,
  topTrigger,
  vulnerableHour,
  triggerApps, 
  improvementStreak,
  vulnerableHourData,
  dailyInsight,
  blueprint,
  heatMap,
  reflectionBreakdown,
  fiveSecondStats,
  onTimelinePress,
  onTestUsage,
  checkInDone,
  checkInResponse,
  onCheckInComplete
}) => {
  const isMorning = new Date().getHours() < 10;
  const showCheckIn = isMorning || checkInDone;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Attention Insights</Text>
      </View>

      {showCheckIn && (
        <MorningCheckIn 
          microChecks={microChecks}
          score={weeklyScores?.[weeklyScores.length - 1]?.presence_score || 100}
          onComplete={onCheckInComplete}
          initialResponse={checkInResponse}
        />
      )}

      <Text style={styles.sectionTitle}>Weekly Activity</Text>
      {weeklyScores && weeklyScores.length > 0 && <WeeklyHeatmap scores={weeklyScores} />}

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
        <InsightCard
          label="Rule Win Rate"
          value={`${fiveSecondStats.rate}%`}
          detail={`${fiveSecondStats.won} Wins / ${fiveSecondStats.lost} Losses`}
        />
      </View>

      {/* Phubbing Heat Signature Section */}
      <View style={styles.featureSection}>
        <Text style={styles.featureTitle}>Phubbing Heat Signature</Text>
        <Text style={styles.featureSubtitle}>Your phone's emotional weight across the day</Text>
        <PhubbingHeatSignature />
      </View>

      <TriggerFingerprint breakdown={reflectionBreakdown} />

      {/* AI Coaching Insight */}
      <View style={styles.insightBox}>
        <Text style={styles.insightBoxLabel}>✨ AI COACHING INSIGHT</Text>
        <Text style={styles.insightBoxText}>{dailyInsight}</Text>
      </View>

      <View style={styles.patternSection}>
        <Text style={styles.sectionTitle}>Behavioral Intelligence</Text>
        
        {/* Vulnerable Hour Card */}
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

        {/* Top Trigger Apps */}
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

        {/* Behavioral Blueprint: Vulnerability Windows */}
        {blueprint && blueprint.vulnerabilityWindows && blueprint.vulnerabilityWindows.length > 0 && (
          <View style={styles.patternCard}>
            <Text style={styles.patternCardIcon}>⚠️</Text>
            <Text style={styles.patternCardLabel}>Vulnerability Windows</Text>
            {blueprint.vulnerabilityWindows.map((w, idx) => (
              <Text key={idx} style={styles.patternAppItem}>
                {formatHourLabel(w.startHour)} – {formatHourLabel(w.endHour)} ({w.severity})
              </Text>
            ))}
          </View>
        )}

        {/* Weekly Trend */}
        {blueprint && blueprint.weeklyTrend && (
          <View style={styles.patternCard}>
            <Text style={styles.patternCardIcon}>
              {blueprint.weeklyTrend === 'improving' ? '📈' : blueprint.weeklyTrend === 'declining' ? '📉' : '➡️'}
            </Text>
            <Text style={styles.patternCardLabel}>Weekly Trend</Text>
            <Text style={styles.patternCardValue}>
              {blueprint.weeklyTrend.charAt(0).toUpperCase() + blueprint.weeklyTrend.slice(1)}
            </Text>
          </View>
        )}

        {/* Improvement Streak */}
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

      {/* Action Buttons */}
      <View style={{ gap: 12, marginTop: 24 }}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onTimelinePress}
        >
          <Text style={styles.primaryButtonText}>View Attention Timeline</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.testButton} onPress={onTestUsage}>
          <Text style={styles.testButtonText}>Test Data Pull</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 10, backgroundColor: '#10B981' }]}
          onPress={async () => {
            const { seedReflectionData } = require('../database/databaseService');
            await seedReflectionData();
            alert('Research data seeded! Restart the app to see the full fingerprint.');
          }}
        >
          <Text style={styles.primaryButtonText}>Seed Research Data</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onBack}
        >
          <Text style={styles.secondaryButtonText}>Back to Summary</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const InsightCard = ({ label, value, emphasize, accentColor, detail }) => (
  <View style={[styles.card, accentColor ? { borderColor: accentColor } : null]}>
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={[styles.cardValue, emphasize && styles.emphasize, accentColor ? { color: accentColor } : null]}>
      {value}
    </Text>
    {detail && <Text style={styles.cardDetail}>{detail}</Text>}
  </View>
);

const styles = StyleSheet.create({
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  backBtn: {
    fontSize: 40,
    color: '#FFF',
    marginRight: 15,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E4E4E7',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  featureSection: {
    marginVertical: 24,
    backgroundColor: '#18181B',
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 14,
    color: '#A1A1AA',
    marginBottom: 24,
    fontWeight: '500',
  },
  cardGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  cardLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cardValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },
  cardDetail: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  emphasize: {
    fontSize: 32,
  },
  insightBox: {
    backgroundColor: '#1A1A3E',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#7C3AED',
    marginVertical: 24,
  },
  insightBoxLabel: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  insightBoxText: {
    color: '#E9D5FF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  patternSection: {
    marginTop: 10,
  },
  patternCard: {
    backgroundColor: '#18181B',
    borderRadius: 24,
    padding: 24,
    marginBottom: 12,
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
  primaryButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  secondaryButtonText: {
    color: '#A1A1AA',
    fontSize: 16,
    fontWeight: '700',
  },
  testButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default InsightsScreen;
