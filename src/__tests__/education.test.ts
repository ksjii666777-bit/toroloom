/**
 * ============================================================================
 * Toroloom — Education API Tests
 * ============================================================================
 *
 * Tests the educationApi module: getCourses, getCourse, getLesson,
 * markLessonProgress. Each test mocks globalThis.fetch to verify correct
 * URL construction, HTTP methods, and request bodies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.unmock('../services/api/education');

import { configureApi } from '../services/api/client';
import { educationApi } from '../services/api/education';
import type { Mock } from 'vitest';

const API_BASE = 'http://localhost:3000/api';
const originalFetch = globalThis.fetch;

// ============================================================================
// educationApi — getCourses
// ============================================================================

describe('educationApi — getCourses', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /education/courses', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockCourses = [
      { id: 'c1', title: 'Stock Basics', description: 'Learn the fundamentals', thumbnail: 'https://example.com/thumb.jpg', duration: '2h', lessons: 5, progress: 0, level: 'beginner', category: 'fundamentals', rating: 4.5, enrolledCount: 1200 },
    ];
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockCourses) };
    });

    const result = await educationApi.getCourses();

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/education/courses`);
    expect(result).toEqual(mockCourses);
  });

  it('attaches auth token', async () => {
    let capturedHeaders: Record<string, string> = {};
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedHeaders = opts.headers;
      return { ok: true, status: 200, json: () => Promise.resolve([]) };
    });

    await educationApi.getCourses();
    expect(capturedHeaders['Authorization']).toBe('Bearer token');
  });

  it('returns empty array when no courses', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve([]),
    });

    const result = await educationApi.getCourses();
    expect(result).toEqual([]);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to fetch courses' }),
    });
    await expect(educationApi.getCourses()).rejects.toThrow('Failed to fetch courses');
  });

  it('throws on network failure', async () => {
    (globalThis.fetch as Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(educationApi.getCourses()).rejects.toThrow('Failed to fetch');
  });
});

// ============================================================================
// educationApi — getCourse
// ============================================================================

describe('educationApi — getCourse', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /education/courses/{courseId}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockDetail = {
      id: 'c1', title: 'Stock Basics', description: 'Learn the fundamentals', thumbnail: 'https://example.com/thumb.jpg', duration: '2h', lessons: 5, progress: 0, level: 'beginner', category: 'fundamentals', rating: 4.5, enrolledCount: 1200,
      lessonList: [{ id: 'l1', courseId: 'c1', title: 'Intro', content: 'Content', duration: '15min', completed: false }],
    };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockDetail) };
    });

    const result = await educationApi.getCourse('c1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/education/courses/c1`);
    expect(result).toEqual(mockDetail);
    expect(result.lessonList).toHaveLength(1);
  });

  it('throws on 404 for unknown course', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Course not found' }),
    });
    await expect(educationApi.getCourse('invalid')).rejects.toThrow('Course not found');
  });
});

// ============================================================================
// educationApi — getLesson
// ============================================================================

describe('educationApi — getLesson', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends GET to /education/lessons/{lessonId}', async () => {
    let capturedUrl = '', capturedMethod = '';
    const mockLesson = { id: 'l1', courseId: 'c1', title: 'Intro', content: 'Lesson content', duration: '15min', completed: false };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve(mockLesson) };
    });

    const result = await educationApi.getLesson('l1');

    expect(capturedMethod).toBe('GET');
    expect(capturedUrl).toBe(`${API_BASE}/education/lessons/l1`);
    expect(result).toEqual(mockLesson);
  });

  it('throws on 404 for unknown lesson', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 404, json: () => Promise.resolve({ error: 'Lesson not found' }),
    });
    await expect(educationApi.getLesson('invalid')).rejects.toThrow('Lesson not found');
  });
});

// ============================================================================
// educationApi — markLessonProgress
// ============================================================================

describe('educationApi — markLessonProgress', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    configureApi({ baseUrl: API_BASE, getToken: () => 'token' });
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends PUT to /education/lessons/{lessonId}/progress', async () => {
    let capturedUrl = '', capturedMethod = '', capturedBody: any = 'not_undefined';
    const mockLesson = { id: 'l1', courseId: 'c1', title: 'Intro', content: 'Content', duration: '15min', completed: true };
    (globalThis.fetch as Mock).mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url;
      capturedMethod = opts.method;
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve(mockLesson) };
    });

    const result = await educationApi.markLessonProgress('l1');

    expect(capturedMethod).toBe('PUT');
    expect(capturedUrl).toBe(`${API_BASE}/education/lessons/l1/progress`);
    expect(capturedBody).toBeUndefined();
    expect(result).toEqual(mockLesson);
  });

  it('returns lesson with completed=true on success', async () => {
    const completedLesson = { id: 'l1', courseId: 'c1', title: 'Intro', content: 'Content', duration: '15min', completed: true };
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true, status: 200, json: () => Promise.resolve(completedLesson),
    });

    const result = await educationApi.markLessonProgress('l1');
    expect(result.completed).toBe(true);
  });

  it('throws on server error', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: false, status: 500, json: () => Promise.resolve({ error: 'Failed to update progress' }),
    });
    await expect(educationApi.markLessonProgress('l1')).rejects.toThrow('Failed to update progress');
  });
});
