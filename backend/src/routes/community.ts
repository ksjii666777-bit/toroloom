import { Router, Request, Response } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getPostsQuerySchema, getPostByIdSchema, createPostSchema, likePostSchema } from '../schemas/community';
import { getPosts, getPost, createPost, likePost } from '../services/community';

const router = Router();

// GET /api/community/posts
router.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? '10'), 10) || 10));
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'hot';

  let posts = await getPosts();

  if (tag) {
    posts = posts.filter(p => p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
  }

  // ── Server-side sorting ────────────────────────────────────────────
  if (sort === 'top') {
    posts.sort((a, b) => b.likes - a.likes);
  } else if (sort === 'new') {
    posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } else {
    // hot: engagement + time-decay (half-life = 6 hours)
    const halfLifeMs = 6 * 60 * 60 * 1000;
    posts.sort((a, b) => {
      const engA = a.likes * 0.6 + a.comments * 0.4;
      const engB = b.likes * 0.6 + b.comments * 0.4;
      const ageA = Date.now() - new Date(a.timestamp).getTime();
      const ageB = Date.now() - new Date(b.timestamp).getTime();
      const scoreA = (engA + 0.01) * Math.pow(0.5, ageA / halfLifeMs);
      const scoreB = (engB + 0.01) * Math.pow(0.5, ageB / halfLifeMs);
      return scoreB - scoreA;
    });
  }

  const start = (page - 1) * limit;
  const paginated = posts.slice(start, start + limit);

  res.json({
    posts: paginated,
    total: posts.length,
    page,
    totalPages: Math.ceil(posts.length / limit),
  });
});

// GET /api/community/posts/:id
router.get('/posts/:id', optionalAuth, async (req: Request, res: Response) => {
  const result = getPostByIdSchema.safeParse({ id: req.params.id });
  if (!result.success) {
    res.status(400).json({ error: 'Invalid post ID' });
    return;
  }
  const post = await getPost(result.data.id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  res.json(post);
});

// POST /api/community/posts
router.post('/posts', authMiddleware, validate(createPostSchema), async (req: Request, res: Response) => {
  const { content, tags } = req.body;

  const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const userId = req.user!.userId;
  const userName = 'Current User';

  const newPost = await createPost(id, userId, userName, content, tags || []);

  res.status(201).json(newPost);
});

// POST /api/community/posts/:id/like
router.post('/posts/:id/like', authMiddleware, async (req: Request, res: Response) => {
  const result = likePostSchema.safeParse({ id: req.params.id });
  if (!result.success) {
    res.status(400).json({ error: 'Invalid post ID' });
    return;
  }
  const likes = await likePost(result.data.id);
  res.json({ likes });
});

// GET /api/community/posts/:id/comments
router.get('/posts/:id/comments', (_req: Request, res: Response) => {
  res.json([]);
});

export default router;
