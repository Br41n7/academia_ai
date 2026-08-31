import { Router } from 'express';
import { supabaseForUser } from '../services/supabaseAdmin.js';
const router = Router();
router.get('/me', async (req, res) => {
    const userSupabase = supabaseForUser(req.accessToken);
    const today = new Date().toISOString().split('T')[0];
    try {
        const { data: profile, error } = await userSupabase
            .from('profiles')
            .select('*')
            .eq('id', req.user.id)
            .single();
        if (error && error.code !== 'PGRST116') {
            res.status(500).json({ error: error.message });
            return;
        }
        const { data: usage } = await userSupabase
            .from('ai_usage')
            .select('count')
            .eq('user_id', req.user.id)
            .eq('usage_date', today)
            .single();
        res.json({
            ...(profile || {
                id: req.user.id,
                full_name: '',
                preferred_model: 'gemini',
                persona: 'friendly',
                region: 'Nigeria',
                points: 0,
                study_streak: 0
            }),
            todayUsage: usage?.count ?? 0
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.put('/me', async (req, res) => {
    const { preferred_model, persona, region, custom_agent_prompt } = req.body;
    const userSupabase = supabaseForUser(req.accessToken);
    try {
        const { data, error } = await userSupabase
            .from('profiles')
            .upsert({
            id: req.user.id,
            preferred_model,
            persona,
            region,
            custom_agent_prompt,
            last_active_at: new Date().toISOString()
        })
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/leaderboard', async (req, res) => {
    const userSupabase = supabaseForUser(req.accessToken);
    try {
        const { data, error } = await userSupabase
            .from('leaderboard')
            .select('*')
            .limit(50);
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/me/points', async (req, res) => {
    const { points } = req.body;
    if (typeof points !== 'number') {
        res.status(400).json({ error: 'Points must be a number' });
        return;
    }
    const userSupabase = supabaseForUser(req.accessToken);
    try {
        const { data: current } = await userSupabase
            .from('profiles')
            .select('points, study_streak')
            .eq('id', req.user.id)
            .single();
        const newPoints = (current?.points ?? 0) + points;
        const { data, error } = await userSupabase
            .from('profiles')
            .update({
            points: newPoints,
            study_streak: (current?.study_streak ?? 0) + 1,
            last_active_at: new Date().toISOString()
        })
            .eq('id', req.user.id)
            .select()
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
export default router;
