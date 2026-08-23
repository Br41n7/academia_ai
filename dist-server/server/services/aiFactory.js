import { GoogleGenAI } from '@google/genai';
export async function executeAIGeneration(preferredModel, prompt, systemInstruction, responseMimeType, keys, image) {
    const baseOrder = ['gemini', 'deepseek', 'claude', 'openai'];
    const order = [preferredModel, ...baseOrder.filter(p => p !== preferredModel)];
    const errors = [];
    for (const provider of order) {
        try {
            if (provider === 'gemini') {
                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                    console.warn('[AI Factory] Skipping Gemini: GEMINI_API_KEY is not configured.');
                    continue;
                }
                console.log('[AI Factory] Attempting Gemini (gemini-2.0-flash)...');
                const aiClient = new GoogleGenAI({ apiKey });
                const contents = [];
                if (image) {
                    contents.push({
                        inlineData: {
                            data: image.base64,
                            mimeType: image.mimeType
                        }
                    });
                }
                contents.push(prompt);
                const config = {
                    systemInstruction
                };
                if (responseMimeType === 'application/json') {
                    config.responseMimeType = 'application/json';
                }
                const response = await aiClient.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents,
                    config
                });
                if (response && response.text) {
                    return response.text;
                }
                throw new Error('Empty response received from Gemini.');
            }
            if (provider === 'deepseek') {
                const apiKey = keys?.deepseekKey || process.env.DEEPSEEK_API_KEY;
                if (!apiKey) {
                    console.warn('[AI Factory] Skipping DeepSeek: API key is not configured.');
                    continue;
                }
                if (image) {
                    console.warn('[AI Factory] Skipping DeepSeek: Vision is not supported.');
                    continue;
                }
                console.log('[AI Factory] Attempting DeepSeek (deepseek-chat)...');
                const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: systemInstruction },
                            { role: 'user', content: prompt }
                        ],
                        response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
                    })
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`DeepSeek API failed with status ${res.status}: ${errText}`);
                }
                const data = await res.json();
                const content = data?.choices?.[0]?.message?.content;
                if (content) {
                    return content;
                }
                throw new Error('Invalid content format returned from DeepSeek.');
            }
            if (provider === 'claude') {
                const apiKey = keys?.anthropicKey || process.env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                    console.warn('[AI Factory] Skipping Claude: API key is not configured.');
                    continue;
                }
                console.log('[AI Factory] Attempting Claude (claude-sonnet-4-6)...');
                let contentPayload;
                if (image) {
                    contentPayload = [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: image.mimeType,
                                data: image.base64
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ];
                }
                else {
                    contentPayload = prompt;
                }
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-6',
                        system: systemInstruction,
                        messages: [
                            { role: 'user', content: contentPayload }
                        ],
                        max_tokens: 4096
                    })
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`Claude API failed with status ${res.status}: ${errText}`);
                }
                const data = await res.json();
                const content = data?.content?.[0]?.text;
                if (content) {
                    return content;
                }
                throw new Error('Invalid content format returned from Claude.');
            }
            if (provider === 'openai') {
                const apiKey = keys?.openaiKey || process.env.OPENAI_API_KEY;
                if (!apiKey) {
                    console.warn('[AI Factory] Skipping OpenAI: API key is not configured.');
                    continue;
                }
                console.log('[AI Factory] Attempting OpenAI (gpt-4o)...');
                let userContent;
                if (image) {
                    userContent = [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${image.mimeType};base64,${image.base64}`
                            }
                        }
                    ];
                }
                else {
                    userContent = prompt;
                }
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: systemInstruction },
                            { role: 'user', content: userContent }
                        ],
                        response_format: responseMimeType === 'application/json' ? { type: 'json_object' } : undefined
                    })
                });
                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(`OpenAI API failed with status ${res.status}: ${errText}`);
                }
                const data = await res.json();
                const content = data?.choices?.[0]?.message?.content;
                if (content) {
                    return content;
                }
                throw new Error('Invalid content format returned from OpenAI.');
            }
        }
        catch (err) {
            console.error(`[AI Factory] Provider ${provider} failed:`, err.message);
            errors.push(`${provider}: ${err.message}`);
        }
    }
    // If we reach this point, all tried providers failed or were skipped
    throw new Error(`All AI generation providers failed: ${errors.join(' | ')}`);
}
