import { Router } from 'express';
import { supabaseAdmin, supabaseForUser } from '../services/supabaseAdmin.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req: AuthRequest, res) => {
  const userSupabase = supabaseForUser(req.accessToken!);
  try {
    const { data, error } = await userSupabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const userSupabase = supabaseForUser(req.accessToken!);
  try {
    const { data, error } = await userSupabase
      .from('projects')
      .insert({
        user_id: req.user!.id,
        name,
        description
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  const { name, description } = req.body;
  const userSupabase = supabaseForUser(req.accessToken!);

  try {
    const { data, error } = await userSupabase
      .from('projects')
      .update({ name, description, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  const userSupabase = supabaseForUser(req.accessToken!);
  try {
    const { error } = await userSupabase
      .from('projects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/invite', async (req: AuthRequest, res) => {
  const { collaborator_email, permission } = req.body;
  const projectId = req.params.id;

  if (!collaborator_email) {
    res.status(400).json({ error: 'Collaborator email is required' });
    return;
  }

  try {
    const { data: { users }, error: userErr } = await supabaseAdmin.auth.admin.listUsers();
    if (userErr) throw userErr;

    const targetUser = users.find((u: any) => u.email?.toLowerCase() === collaborator_email.toLowerCase());
    if (!targetUser) {
      res.status(404).json({ error: 'User with that email not found.' });
      return;
    }

    const userSupabase = supabaseForUser(req.accessToken!);
    const { data, error } = await userSupabase
      .from('project_collaborators')
      .insert({
        project_id: projectId,
        owner_id: req.user!.id,
        collaborator_id: targetUser.id,
        permission: permission || 'read'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/collaborators/:collaboratorId', async (req: AuthRequest, res) => {
  const userSupabase = supabaseForUser(req.accessToken!);
  try {
    const { error } = await userSupabase
      .from('project_collaborators')
      .delete()
      .eq('project_id', req.params.id)
      .eq('collaborator_id', req.params.collaboratorId);

    if (error) throw error;
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/collaborators', async (req: AuthRequest, res) => {
  const userSupabase = supabaseForUser(req.accessToken!);
  try {
    const { data, error } = await userSupabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', req.params.id);

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
