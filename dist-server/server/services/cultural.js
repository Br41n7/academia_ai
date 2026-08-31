const CULTURAL_PROFILES = {
    Nigeria: {
        foods: ['jollof rice', 'suya', 'pounded yam', 'egusi', 'chin chin', 'puff puff'],
        transport: ['danfo bus', 'keke napep', 'okada'],
        objects: ['generator (I pass my neighbor)', 'jerrycan', 'metal bucket', 'naira notes'],
        exams: ['WAEC', 'JAMB / UTME', 'NECO'],
        forbidden: ['pizza', 'hot dogs', 'snow', 'yellow school buses', 'basements', 'Subway sandwiches', 'Thanksgiving dinner', 'dollar bills', '401k', 'yard sale']
    },
    Ghana: {
        foods: ['waakye', 'banku', 'shito', 'jollof rice', 'kelewele'],
        transport: ['trotro', 'pragya'],
        objects: ['ghana must go bag', 'cedi notes', 'lantern'],
        exams: ['WASSCE', 'BECE'],
        forbidden: ['pizza', 'hot dogs', 'snow', 'yellow school buses', 'basements', 'Subway sandwiches', 'Thanksgiving dinner', 'dollar bills', '401k', 'yard sale']
    },
    Kenya: {
        foods: ['ugali', 'sukuma wiki', 'nyama choma', 'chapati', 'mandazi'],
        transport: ['matatu', 'boda boda'],
        objects: ['shilling notes', 'jiko stove', 'kiondo basket'],
        exams: ['KCSE', 'KCPE'],
        forbidden: ['pizza', 'hot dogs', 'snow', 'yellow school buses', 'basements', 'Subway sandwiches', 'Thanksgiving dinner', 'dollar bills', '401k', 'yard sale']
    },
    'South Africa': {
        foods: ['braai', 'biltong', 'boerewors', 'pap', 'bunny chow'],
        transport: ['minibus taxi', 'Gautrain'],
        objects: ['rand notes', 'load shedding generator', 'skottel braai'],
        exams: ['NSC / Matric'],
        forbidden: ['pizza', 'hot dogs', 'snow', 'yellow school buses', 'basements', 'Subway sandwiches', 'Thanksgiving dinner', 'dollar bills', '401k', 'yard sale']
    },
    India: {
        foods: ['samosa', 'chai', 'dosa', 'dal', 'biryani', 'roti'],
        transport: ['auto rickshaw', 'local train'],
        objects: ['rupee notes', 'tiffin box', 'earthen pot'],
        exams: ['CBSE', 'ICSE', 'JEE', 'NEET'],
        forbidden: ['pizza', 'hot dogs', 'snow', 'yellow school buses', 'basements', 'Subway sandwiches', 'Thanksgiving dinner', 'dollar bills', '401k', 'yard sale']
    },
    Default: {
        foods: ['rice and beans', 'flatbread', 'roasted corn', 'fruit'],
        transport: ['bus', 'bicycle', 'shared taxi'],
        objects: ['market basket', 'clay pot', 'notebook'],
        exams: ['O-Level', 'A-Level', 'High School Exit Exam'],
        forbidden: ['pizza', 'hot dogs', 'snow', 'yellow school buses', 'basements', 'Subway sandwiches', 'Thanksgiving dinner', 'dollar bills', '401k', 'yard sale']
    }
};
export function buildCulturalPrompt(region) {
    const profile = CULTURAL_PROFILES[region] || CULTURAL_PROFILES.Default;
    return `
CULTURAL GROUNDING & ANALOGY INSTRUCTIONS:
- Primary Region: ${region}
- Approved Analogy References:
  * Local Foods: ${profile.foods.join(', ')}
  * Local Transport: ${profile.transport.join(', ')}
  * Everyday Objects: ${profile.objects.join(', ')}
  * Local Exam Systems: ${profile.exams.join(', ')}

FORBIDDEN REFERENCES (DO NOT USE):
${profile.forbidden.map(item => `  * ${item}`).join('\n')}

Rule: If no specific local analogy fits, use universal concepts: water, fire, the sun, a seed growing, weight of a stone. Never default to Western consumer culture.
`;
}
