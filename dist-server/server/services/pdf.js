import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
/**
 * Parses PDF buffer using pdf-parse package.
 */
export async function parsePdfBuffer(buffer) {
    const data = await pdf(buffer);
    return data.text || '';
}
/**
 * Sanitizes raw text extracted from documents.
 */
export function sanitizeText(raw) {
    if (!raw)
        return '';
    let text = raw;
    // 1. Fix ligatures
    const ligatures = {
        'ﬁ': 'fi',
        'ﬂ': 'fl',
        'ﬀ': 'ff',
        'ﬃ': 'ffi',
        'ﬄ': 'ffl',
        'Æ': 'AE',
        'æ': 'ae',
        'œ': 'oe',
        'Œ': 'OE'
    };
    for (const [lig, replacement] of Object.entries(ligatures)) {
        text = text.split(lig).join(replacement);
    }
    // 2. Fix hyphenated line breaks (e.g., "com-\nputer" -> "computer")
    text = text.replace(/(\w+)-\s*\r?\n\s*(\w+)/g, '$1$2');
    // 3. Remove non-printable control characters except standard whitespace (newlines, carriage returns, tabs)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // 4. Normalize spacing (multiple horizontal spaces -> single space)
    text = text.replace(/[ \t]+/g, ' ');
    // 5. Clean up surrounding whitespace of paragraphs
    text = text.split(/\r?\n/).map(line => line.trim()).join('\n');
    // 6. Reduce multi-newlines to maximum 2 newlines (for paragraph structure)
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}
/**
 * Chunks a sanitized string into ~2000 character segments, splitting on paragraph breaks (\n\n).
 */
export function chunkText(text, targetSize = 2000) {
    const paragraphs = text.split('\n\n');
    const chunks = [];
    let currentChunk = '';
    for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();
        if (!trimmedPara)
            continue;
        // If paragraph itself is excessively large, slice it into targetSize pieces
        if (trimmedPara.length > targetSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            let remaining = trimmedPara;
            while (remaining.length > 0) {
                if (remaining.length <= targetSize) {
                    chunks.push(remaining.trim());
                    break;
                }
                // Try to break on a sentence boundary close to targetSize
                let splitIdx = remaining.lastIndexOf('. ', targetSize);
                if (splitIdx < targetSize * 0.5) {
                    splitIdx = targetSize; // Fallback to hard slice
                }
                else {
                    splitIdx += 1; // Include period
                }
                chunks.push(remaining.substring(0, splitIdx).trim());
                remaining = remaining.substring(splitIdx).trim();
            }
            continue;
        }
        if ((currentChunk + '\n\n' + trimmedPara).length > targetSize) {
            chunks.push(currentChunk.trim());
            currentChunk = trimmedPara;
        }
        else {
            currentChunk = currentChunk ? currentChunk + '\n\n' + trimmedPara : trimmedPara;
        }
    }
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}
