import { getDailyMetrics } from '../database/databaseService';
import { analyzePatterns } from '../engine/patternAnalyzer';
const GEMINI_API_KEY = 'AIzaSyB7xU2ou0VBYMwFe0tgozvSm-9gQrRA-DY'; // Provided by user

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const fetchDailyInsight = async () => {
    try {
        const metrics = await getDailyMetrics();
        const patterns = await analyzePatterns();

        let microChecks = metrics ? metrics.microChecks : 0;
        let presenceScore = metrics ? metrics.presenceScore : 100;
        let topTrigger = patterns ? patterns.topTrigger : 'Unknown';

        const prompt = `
            You are a behavioral coach helping a user reduce phone addiction, specifically "phubbing" (ignoring physical company for a phone).
            Today's Data:
            - Presence Score: ${presenceScore}/100
            - Micro-checks (short unlocks): ${microChecks}
            - Most common phubbing trigger: ${topTrigger}
            
            Write a very short, punchy (max 2 sentences) encouraging tip or reflection to help them improve tomorrow. Do not use generic advice. Be specific to their data.
        `;

        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[LLMService] HTTP error response:', response.status, errorText);
            return "Take a deep breath. Let's focus on being present tomorrow.";
        }

        const data = await response.json();
        const insight = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        return insight ? insight.trim() : "Tomorrow is a new day to be present.";
    } catch (error) {
        console.error('[LLMService] Error fetching insight:', error);
        return "Disconnect to reconnect. Your presence matters.";
    }
};
