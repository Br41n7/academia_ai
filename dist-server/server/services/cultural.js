export const CULTURAL_PROFILES = {
    nigeria: {
        foods: ['Jollof rice', 'Eba', 'Suya', 'Puff puff', 'Garri', 'Akara'],
        transport: ['Danfo', 'Keke Napep', 'Okada', 'BRT bus'],
        objects: ['Generator', 'NEPA', 'Naira', 'Kerosene stove'],
        markets: ['Alaba Market', 'Mile 12', 'Balogun Market'],
        exams: ['WAEC', 'JAMB', 'NECO', 'Post-UTME'],
    },
    ghana: {
        foods: ['Waakye', 'Banku', 'Kenkey', 'Fufu', 'Kelewele'],
        transport: ['Trotro', 'Keke', 'Taxi'],
        objects: ['Cedi', 'Ghanaian Generator', 'Kerosene lamp'],
        markets: ['Makola Market', 'Kejetia Market'],
        exams: ['WASSCE', 'BECE'],
    },
    kenya: {
        foods: ['Ugali', 'Sukuma wiki', 'Nyama choma', 'Mandazi'],
        transport: ['Matatu', 'Boda boda', 'Tuk-tuk'],
        objects: ['Ksh', 'Safaricom M-Pesa', 'Jiko'],
        markets: ['Maasai Market', 'Gikomba Market'],
        exams: ['KCSE', 'KCPE'],
    },
    'south africa': {
        foods: ['Pap', 'Boerewors', 'Biltong', 'Bunny chow'],
        transport: ['Minibus taxi', 'Metrorail', 'Gautrain'],
        objects: ['Rand', 'Load shedding', 'Braai grid'],
        markets: ['Neighbourgoods Market', 'Victoria Street Market'],
        exams: ['NSC Matric', 'IEB'],
    },
    india: {
        foods: ['Roti', 'Biryani', 'Samosa', 'Idli', 'Masala chai'],
        transport: ['Auto rickshaw', 'Local train', 'Metro'],
        objects: ['Rupee', 'Inverter', 'Pressure cooker'],
        markets: ['Chandni Chowk', 'Crawford Market'],
        exams: ['CBSE', 'ICSE', 'JEE', 'NEET'],
    },
    default: {
        foods: ['Rice', 'Beans', 'Stew', 'Bread'],
        transport: ['Bus', 'Taxi', 'Bicycle'],
        objects: ['Notebook', 'Phone', 'Lamp'],
        markets: ['Local Market'],
        exams: ['Local Exams'],
    }
};
export function buildCulturalPrompt(region) {
    const normRegion = (region || 'default').toLowerCase().trim();
    const profile = CULTURAL_PROFILES[normRegion] || CULTURAL_PROFILES.default;
    return `CULTURAL GROUNDING INSTRUCTION:
You are tutoring an African student. To make concepts intuitive, you must ONLY use cultural analogies, examples, and terminology familiar to their region.
For this session, the student's region profile has these approved real-world references:
- Foods to use: [${profile.foods.join(', ')}]
- Local transport to use: [${profile.transport.join(', ')}]
- Local objects/concepts to use: [${profile.objects.join(', ')}]
- Local exams to reference: [${profile.exams.join(', ')}]

CRITICAL DIRECTIVE:
You are strictly FORBIDDEN from using any Westernized, North American, or unfamiliar references.
Specifically, DO NOT mention: pizza, hot dogs, snow, yellow school buses, basements, Subway sandwiches, Thanksgiving dinner, dollar bills, 401k, baseball, American football, or any other reference not aligned with the regional profile.
Explain concepts using the local equivalent from their profile.`;
}
