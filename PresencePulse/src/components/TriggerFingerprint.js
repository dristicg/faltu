import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const INTERPRETATIONS = {
  "Boredom": "Boredom-driven checking is the easiest to break — try having a small physical task nearby.",
  "Anxiety": "Anxiety checks often avoid a deeper stress. Try 1 minute of box breathing before re-opening.",
  "Pure habit": "Habit checks are automatic. Use the 5-second rule pause to break the unconscious cycle.",
  "Notification": "External triggers control your time. Consider batching your notifications once an hour.",
  "Curiosity": "Social curiosity is natural, but it's often a 'slot machine' loop. Schedule specific social check-ins."
};

const COLORS = {
    "Boredom": "#3B82F6",
    "Anxiety": "#EF4444",
    "Pure habit": "#8B5CF6",
    "Notification": "#F59E0B",
    "Curiosity": "#10B981"
};

export default function TriggerFingerprint({ breakdown }) {
    // breakdown is an object: { "Boredom": 51, "Pure habit": 21, ... }
    const entries = Object.entries(breakdown);

    const isDemo = entries.length === 0;
    const activeEntries = isDemo ? [
        ["Pure habit", 45],
        ["Boredom", 30],
        ["Notification", 15],
        ["Anxiety", 10]
    ] : entries;

    const topTrigger = activeEntries[0][0];

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.label}>🧠 TRIGGER FINGERPRINT</Text>
                {isDemo && (
                    <View style={styles.demoBadge}>
                        <Text style={styles.demoBadgeText}>PRELIMINARY PATTERN</Text>
                    </View>
                )}
            </View>
            
            <View style={styles.chartContainer}>
                {activeEntries.map(([type, percentage]) => (
                    <View key={type} style={styles.barRow}>
                        <View style={styles.labelRow}>
                            <Text style={styles.typeText}>{type}</Text>
                            <Text style={styles.percentageText}>{percentage}%</Text>
                        </View>
                        <View style={styles.track}>
                            <View 
                                style={[
                                    styles.fill, 
                                    { 
                                        width: `${percentage}%`, 
                                        backgroundColor: COLORS[type] || '#71717A' 
                                    }
                                ]} 
                            />
                        </View>
                        <Text style={styles.interpretiveText}>{INTERPRETATIONS[type]}</Text>
                    </View>
                ))}
            </View>

            {isDemo && (
                <Text style={styles.demoFooter}>
                    We are calculating your specific fingerprint. This preliminary pattern is based on your initial checks.
                </Text>
            )}

            <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Primary Driver: {topTrigger}</Text>
                <Text style={styles.summaryBody}>
                    Your phone use is primarily driven by {topTrigger.toLowerCase()}. Understanding this 'why' is the first step to reclaiming your attention.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignSelf: 'stretch',
        backgroundColor: '#18181B',
        padding: 20,
        borderRadius: 30,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: '#27272A',
        overflow: 'hidden',
    },
    label: {
        color: '#A1A1AA',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        flexShrink: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        gap: 8,
    },
    demoBadge: {
        backgroundColor: 'rgba(0, 255, 163, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#00FFA3',
    },
    demoBadgeText: {
        color: '#00FFA3',
        fontSize: 8,
        fontWeight: '900',
    },
    demoFooter: {
        color: '#52525B',
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: 10,
        textAlign: 'center',
    },
    chartContainer: {
        gap: 16,
    },
    barRow: {
        marginBottom: 4,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    typeText: {
        color: '#F4F4F5',
        fontSize: 14,
        fontWeight: '800',
    },
    percentageText: {
        color: '#00FFA3',
        fontSize: 14,
        fontWeight: '900',
    },
    track: {
        height: 8,
        backgroundColor: '#27272A',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6,
    },
    fill: {
        height: '100%',
        borderRadius: 4,
    },
    interpretiveText: {
        color: '#A1A1AA',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500',
    },
    summaryBox: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#27272A',
    },
    summaryTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 4,
    },
    summaryBody: {
        color: '#71717A',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
    },
    emptyText: {
        color: '#71717A',
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 20,
    }
});
