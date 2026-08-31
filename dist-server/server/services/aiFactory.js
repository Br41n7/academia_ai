import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
// Task routing — determines which provider is primary
const GROQ_TASKS = [
    'course_builder', 'study_guide', 'slide_deck',
    'flashcard', 'mnemonic', 'shortcut'
];
const GEMINI_TASKS = [
    'living_concept', 'snap_solve', 'quiz', 'exam',
    'concept_battle', 'research_validator', 'storyboard',
    'notebook', 'confusion', 'doc_chat', 'extract_entities', 'query_corpus'
];
export async function executeAI(options) {
    const { task, prompt, systemInstruction, responseFormat, image, userKeys } = options;
    // Vision tasks always go to Gemini (Groq has no vision support)
    const needsVision = !!image;
    const primaryProvider = (needsVision || GEMINI_TASKS.includes(task))
        ? 'gemini'
        : 'groq';
    const errors = [];
    // Try primary provider first, then fallback
    const providerOrder = primaryProvider === 'gemini'
        ? ['gemini', 'groq']
        : ['groq', 'gemini'];
    for (const provider of providerOrder) {
        try {
            if (provider === 'gemini') {
                const key = process.env.GEMINI_API_KEY;
                if (!key) {
                    errors.push('Gemini: no key');
                    continue;
                }
                const ai = new GoogleGenAI({ apiKey: key });
                const contents = [];
                if (image) {
                    contents.push({ inlineData: { data: image.base64, mimeType: image.mimeType } });
                }
                contents.push(prompt);
                const response = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents,
                    config: {
                        systemInstruction,
                        responseMimeType: responseFormat === 'json' ? 'application/json' : undefined,
                    }
                });
                const text = response.text;
                if (!text)
                    throw new Error('Empty response from Gemini');
                return text;
            }
            if (provider === 'groq') {
                const key = userKeys?.groqKey || process.env.GROQ_API_KEY;
                if (!key) {
                    errors.push('Groq: no key');
                    continue;
                }
                const groq = new Groq({ apiKey: key });
                const messages = [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ];
                const completion = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages,
                    response_format: responseFormat === 'json'
                        ? { type: 'json_object' }
                        : undefined,
                    max_tokens: 8000,
                    temperature: 0.7,
                });
                const text = completion.choices[0]?.message?.content;
                if (!text)
                    throw new Error('Empty response from Groq');
                return text;
            }
        }
        catch (err) {
            errors.push(`${provider}: ${err.message}`);
            console.warn(`[AIFactory] ${provider} failed:`, err.message);
        }
    }
    throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}
