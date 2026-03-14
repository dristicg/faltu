import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const getScoreColor = (score) => {
    if (score === null || score === undefined) return '#EEEEEE';
    if (score >= 80) return '#2D9E5F';
    if (score >= 65) return '#7BC47F';
    if (score >= 50) return '#FFB347';
    if (score >= 35) return '#FF7043';
    return '#E94560';
};

const generateLast7Days = (scores) => {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = DAY_LABELS[d.getDay()];

        const match = scores.find((s) => s.date === dateStr);
        days.push({
            date: dateStr,
            score: match ? match.presence_score : null,
            dayLabel,
        });
    }

    return days;
};

export default function WeeklyHeatmap({ scores = [] }) {
    const days = generateLast7Days(scores);

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>7-DAY PRESENCE</Text>
            <View style={styles.row}>
                {days.map((day) => {
                    const bgColor = getScoreColor(day.score);
                    const textColor = day.score === null ? '#999' : '#FFF';
                    return (
                        <View key={day.date} style={styles.dayColumn}>
                            <View style={[styles.square, { backgroundColor: bgColor }]}>
                                <Text style={[styles.scoreText, { color: textColor }]}>
                                    {day.score !== null ? day.score : '–'}
                                </Text>
                            </View>
                            <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#2F3B53',
    },
    sectionTitle: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 14,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayColumn: {
        alignItems: 'center',
        gap: 6,
    },
    square: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scoreText: {
        fontSize: 12,
        fontWeight: '700',
    },
    dayLabel: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
    },
});
