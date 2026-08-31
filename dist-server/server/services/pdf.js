import pdfParse from 'pdf-parse';
export async function parsePdfBuffer(buffer) {
    const data = await pdfParse(buffer);
    return data.text || '';
}
export function sanitizeText(text) {
    if (!text)
        return '';
    return text
        // Replace non-printable ASCII / control chars except tabs/newlines
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
        // Fix hyphenated line breaks (e.g. "exam-\nple" -> "example")
        .replace(/(\w+)-\r?\n(\w+)/g, '$1$2')
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        // Normalize spaces/tabs
        .replace(/[ \t]+/g, ' ')
        // Normalize multiple newlines (keep max 2 for paragraphs)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
export function chunkText(text, chunkSize = 2000) {
    if (!text)
        return [];
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = '';
    for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length <= chunkSize) {
            currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
        }
        else {
            if (currentChunk)
                chunks.push(currentChunk);
            if (para.length > chunkSize) {
                // Para itself is longer than chunkSize, hard split by length
                let remaining = para;
                while (remaining.length > 0) {
                    chunks.push(remaining.substring(0, chunkSize));
                    remaining = remaining.substring(chunkSize);
                }
                currentChunk = '';
            }
            else {
                currentChunk = para;
            }
        }
    }
    if (currentChunk)
        chunks.push(currentChunk);
    return chunks;
}
