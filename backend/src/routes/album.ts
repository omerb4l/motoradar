import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { createAlbumPost, deleteAlbumPost, getAlbumPostsForUser } from '../services/albumService';

const createAlbumPostSchema = z.object({
  photoUrl: z.string().min(1),
  caption: z.string().max(1000).optional(),
  locationName: z.string().max(200).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  motorcycleId: z.string().uuid().optional(),
});

export const albumRoutes = Router();
albumRoutes.use(requireAuth);

albumRoutes.get('/', async (req, res) => {
  try {
    const posts = await getAlbumPostsForUser(req.userId!);
    res.json(posts);
  } catch (err) {
    console.error('Failed to get album posts', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

albumRoutes.post('/', async (req, res) => {
  const parsed = createAlbumPostSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  try {
    const post = await createAlbumPost(req.userId!, parsed.data);
    res.status(201).json(post);
  } catch (err) {
    console.error('Failed to create album post', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

albumRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteAlbumPost(req.userId!, req.params.id);
    if (!deleted) {
      res.status(404).json({ message: 'Post not found' });
      return;
    }
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Failed to delete album post', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});
