import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';

export default function ReconnectScreen({ burstCount, onComplete, onSkip }) {
    const [mode, setMode] = useState('menu'); // 'menu' | 'breathe' | 'block'
    const [timeLeft, setTimeLeft] = useState(120);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const timerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            scaleAnim.stopAnimation();
        };
    }, []);

    const startBreathing = () => {
        setMode('breathe');
        setTimeLeft(120);

        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        const animateParams = {
            toValue: 1.6,
            duration: 4000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
        };

        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, animateParams),
                Animated.timing(scaleAnim, { ...animateParams, toValue: 1 })
            ])
        ).start();
    };

    const isInhaling = timeLeft % 8 >= 4;

    if (mode === 'breathe') {
        if (timeLeft === 0) {
            return (
                <View style={styles.container}>
                    <Text style={styles.successTitle}>Well done. You are back.</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={onComplete}>
                        <Text style={styles.btnText}>I am back ✓</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <Text style={styles.timer}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
                <View style={styles.animationContainer}>
                    <Animated.View style={[styles.circle, { transform: [{ scale: scaleAnim }] }]} />
                    <Text style={styles.breatheText}>{isInhaling ? 'Inhale' : 'Exhale'}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>You drifted into phone mode again.</Text>
            <Text style={styles.subtitle}>
                We detected {burstCount} burst limits exceeded today. Let's disconnect for a moment.
            </Text>

            <View style={styles.optionsList}>
                <TouchableOpacity style={styles.optionCard} onPress={startBreathing}>
                    <Text style={styles.cardTitle}>1. Guided breathing</Text>
                    <Text style={styles.cardDesc}>2-minute visual exercise to reset your nervous system.</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={() => {/* Mock */ }}>
                    <Text style={styles.cardTitle}>2. Take a short walk</Text>
                    <Text style={styles.cardDesc}>Leave your phone on the desk and walk for 5 minutes.</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={() => {/* Mock */ }}>
                    <Text style={styles.cardTitle}>3. 30-minute block</Text>
                    <Text style={styles.cardDesc}>Commit to staying off your phone and lock distracting apps.</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
                <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1A1A2E',
        padding: 24,
        justifyContent: 'center'
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#F1F5F9',
        textAlign: 'center',
        marginBottom: 12
    },
    subtitle: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24
    },
    optionsList: {
        width: '100%'
    },
    optionCard: {
        backgroundColor: '#533483', // Purple accent
        padding: 20,
        borderRadius: 16,
        marginBottom: 16
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        marginBottom: 4
    },
    cardDesc: {
        fontSize: 14,
        color: '#E2E8F0'
    },
    skipBtn: {
        marginTop: 20,
        alignItems: 'center'
    },
    skipText: {
        color: '#64748B',
        fontSize: 16,
        fontWeight: '600'
    },
    timer: {
        fontSize: 32,
        fontWeight: '300',
        color: '#F1F5F9',
        position: 'absolute',
        top: 60,
        alignSelf: 'center'
    },
    animationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    circle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#2D9E5F', // Green accent
        opacity: 0.6,
        position: 'absolute'
    },
    breatheText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#F1F5F9',
        zIndex: 10
    },
    successTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2D9E5F',
        textAlign: 'center',
        marginBottom: 40
    },
    primaryBtn: {
        backgroundColor: '#2D9E5F',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    btnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold'
    }
});
