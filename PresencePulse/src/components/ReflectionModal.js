import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { markNudgeDismissed, markNudgeEngaged, saveReflection } from '../database/databaseService';

const REFLECTION_OPTIONS = [
    { id: 'boredom', emoji: '🥱', title: 'Boredom', desc: 'Just looking for something to do' },
    { id: 'anxiety', emoji: '😰', title: 'Anxiety', desc: 'Feeling stressed or avoiding something' },
    { id: 'habit', emoji: '🔄', title: 'Pure habit', desc: 'Opened phone without thinking' },
    { id: 'notification', emoji: '🔔', title: 'Notification', desc: 'Checking a specific alert' },
    { id: 'curiosity', emoji: '🤔', title: 'Curiosity', desc: 'Wondering if someone replied' },
];

export default function ReflectionModal({ visible, onClose }) {
    const [thankYouMode, setThankYouMode] = useState(false);

    const handleSelect = async (triggerType) => {
        await saveReflection(triggerType, null); // session_id null for now
        await markNudgeEngaged();

        setThankYouMode(true);
        setTimeout(() => {
            setThankYouMode(false);
            onClose();
        }, 1500);
    };

    const handleDismiss = async () => {
        await markNudgeDismissed();
        onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true}>
            <View style={styles.overlay}>
                <View style={styles.content}>

                    {thankYouMode ? (
                        <View style={styles.thankYouContainer}>
                            <Text style={styles.thankYouIcon}>🌱</Text>
                            <Text style={styles.thankYouText}>Thanks for reflecting.</Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.title}>Why did you check your phone just now?</Text>
                            <Text style={styles.subtitle}>Taking a second to notice builds mindful habits.</Text>

                            {REFLECTION_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                    key={opt.id}
                                    style={styles.optionBtn}
                                    onPress={() => handleSelect(opt.title)}
                                >
                                    <Text style={styles.emoji}>{opt.emoji}</Text>
                                    <View style={styles.textContainer}>
                                        <Text style={styles.optTitle}>{opt.title}</Text>
                                        <Text style={styles.optDesc}>{opt.desc}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
                                <Text style={styles.dismissText}>Not now</Text>
                            </TouchableOpacity>
                        </>
                    )}

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    content: {
        backgroundColor: '#1E293B',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#F1F5F9',
        marginBottom: 8,
        textAlign: 'center'
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        marginBottom: 24,
        textAlign: 'center'
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#334155',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    emoji: {
        fontSize: 28,
        marginRight: 16
    },
    textContainer: {
        flex: 1
    },
    optTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F8FAFC'
    },
    optDesc: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2
    },
    dismissBtn: {
        marginTop: 16,
        padding: 12,
        alignItems: 'center'
    },
    dismissText: {
        color: '#64748B',
        fontSize: 16,
        fontWeight: '600'
    },
    thankYouContainer: {
        alignItems: 'center',
        paddingVertical: 32
    },
    thankYouIcon: {
        fontSize: 48,
        marginBottom: 16
    },
    thankYouText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2D9E5F'
    }
});
