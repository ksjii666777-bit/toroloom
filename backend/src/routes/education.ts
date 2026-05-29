import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { mockCourses, mockLessons } from '../data/mockData';

const router = Router();
router.use(authMiddleware);

// GET /api/education/courses
router.get('/courses', (_req: Request, res: Response) => {
  res.json(mockCourses);
});

// GET /api/education/courses/:id
router.get('/courses/:id', (req: Request, res: Response) => {
  const course = mockCourses.find(c => c.id === req.params.id);
  if (!course) {
    res.status(404).json({ error: 'Course not found' });
    return;
  }

  const lessons = mockLessons.filter(l => l.courseId === req.params.id);
  res.json({ ...course, lessonList: lessons });
});

// GET /api/education/lessons/:id
router.get('/lessons/:id', (req: Request, res: Response) => {
  const lesson = mockLessons.find(l => l.id === req.params.id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  res.json(lesson);
});

// PUT /api/education/lessons/:id/progress
router.put('/lessons/:id/progress', (req: Request, res: Response) => {
  const lesson = mockLessons.find(l => l.id === req.params.id);
  if (!lesson) {
    res.status(404).json({ error: 'Lesson not found' });
    return;
  }
  lesson.completed = true;
  res.json(lesson);
});

export default router;
