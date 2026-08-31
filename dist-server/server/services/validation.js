import { z } from 'zod';
export const quizSchema = z.object({
    questions: z.array(z.object({
        id: z.string().optional(),
        question: z.string(),
        options: z.array(z.string()),
        correctAnswer: z.string(),
        explanation: z.string()
    }))
});
export const mnemonicSchema = z.object({
    mnemonic: z.string(),
    explanation: z.string()
});
export const battleSchema = z.object({
    conceptA: z.string(),
    conceptB: z.string(),
    winner: z.string().optional(),
    comparison: z.array(z.object({
        feature: z.string(),
        a: z.string(),
        b: z.string()
    })).optional()
});
export const storyboardSchema = z.object({
    panels: z.array(z.object({
        panelNumber: z.number().optional(),
        description: z.string(),
        dialogue: z.string().optional()
    }))
});
export const snapSolveSchema = z.object({
    problemText: z.string(),
    solutionSteps: z.array(z.string()),
    finalAnswer: z.string()
});
export const shortcutSchema = z.object({
    shortcutText: z.string(),
    explanation: z.string()
});
export const livingConceptSchema = z.object({
    concept: z.string(),
    explanation: z.string(),
    analogy: z.string().optional()
});
export const researchSchema = z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    entities: z.array(z.object({
        name: z.string(),
        category: z.string(),
        relevance: z.string().optional()
    })).optional()
});
export const courseSchema = z.object({
    title: z.string(),
    description: z.string(),
    modules: z.array(z.any())
});
const SCHEMAS = {
    quiz: quizSchema,
    mnemonic: mnemonicSchema,
    battle: battleSchema,
    storyboard: storyboardSchema,
    snap_solve: snapSolveSchema,
    shortcut: shortcutSchema,
    living_concept: livingConceptSchema,
    research: researchSchema,
    course: courseSchema
};
export function validateOutput(raw, schemaName) {
    try {
        let clean = raw.trim();
        if (clean.startsWith('```json')) {
            clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        else if (clean.startsWith('```')) {
            clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const parsed = JSON.parse(clean);
        const schema = SCHEMAS[schemaName];
        if (!schema) {
            return { success: true, data: parsed };
        }
        const result = schema.safeParse(parsed);
        if (result.success) {
            return { success: true, data: result.data };
        }
        else {
            return { success: false, error: result.error.message };
        }
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
export function checkRelevance(prompt, response) {
    if (!prompt || !response)
        return true;
    const stopWords = new Set(['what', 'when', 'where', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
    const words = prompt
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
    if (words.length === 0)
        return true;
    const responseText = response.toLowerCase();
    let matches = 0;
    for (const word of words) {
        if (responseText.includes(word)) {
            matches++;
        }
    }
    return (matches / words.length) >= 0.10;
}
