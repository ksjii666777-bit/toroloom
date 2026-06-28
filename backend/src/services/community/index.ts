/**
 * ============================================================================
 * Toroloom Community Service
 * ============================================================================
 *
 * Manages community post persistence via a pluggable StorageEngine.
 * Follows the same pattern as the broker factory (configure → use → persist).
 *
 * Usage:
 *   import { configureCommunityPersistence, getPosts } from './services/community';
 *   configureCommunityPersistence(storage);
 *   const posts = await getPosts();
 * ============================================================================
 */

import type { StorageEngine, CommunityPostData } from '../storage/types';

// ==================== Internal State ====================

/** Optional StorageEngine for persisting community posts. */
let communityStorage: StorageEngine | null = null;

// Fallback mock data for when no storage is configured
const mockPostContents = [
  'Just made my first 1 lakh profit on RELIANCE calls! 🚀 The technical setup was perfect with the breakout above 2850.',
  'Anyone else looking at ITC? The valuation looks attractive at current levels. 4% dividend yield is a bonus! 📊',
  'Started my first SIP today! ₹5000/month in Parag Parikh Flexi Cap Fund. Better late than never! 💪 #StartSmall',
  'Market outlook this week: Nifty facing resistance at 23500. If it breaks, we could see 23800. Support at 23100. Trade carefully! 🎯',
  'Just completed the Technical Analysis course on this app! Amazing content. Highly recommend it for beginners who want to learn chart patterns. 📚',
  'Gold vs Equities: Where should you invest in 2025? Here is my analysis based on historical data and current market conditions...',
  'Does anyone have experience with F&O trading? Looking for tips on risk management strategies for options selling.',
  'RELIANCE Q4 results were amazing! Revenue up 15% YoY, EBITDA margins expanding. Long-term hold for sure! 📈',
  'Built a small case study on how SIP investing in mid-cap funds outperformed lump sum over 5 years. Data inside! 🧵',
  'Today I learned about the importance of asset allocation. 60% equity, 30% debt, 10% gold — working well for me so far!',
];

const mockUserNames = [
  'Priya Patel', 'Arun Kumar', 'Neha Singh', 'Vikram Reddy', 'Sneha Kapoor',
  'Rohit Mehra', 'Ananya Gupta', 'Karan Joshi', 'Deepika Sharma', 'Akash Verma',
];

const mockTagSets = [
  ['RELIANCE', 'Options', 'Profit'],
  ['ITC', 'ValueInvesting', 'Dividend'],
  ['SIP', 'MutualFunds', 'Beginner'],
  ['Nifty', 'MarketOutlook', 'Analysis'],
  ['Learning', 'TechnicalAnalysis', 'Review'],
  ['Gold', 'Equities', 'Investment'],
  ['F&O', 'RiskManagement', 'Options'],
  ['RELIANCE', 'Results', 'Earnings'],
  ['SIP', 'MidCap', 'MutualFunds'],
  ['AssetAllocation', 'Portfolio', 'Strategy'],
];

function generateMockPosts(): CommunityPostData[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `p${i + 1}`,
    userId: `u${i + 2}`,
    userName: mockUserNames[i],
    content: mockPostContents[i],
    likes: Math.floor(Math.random() * 300) + 20,
    comments: Math.floor(Math.random() * 50) + 5,
    timestamp: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    tags: mockTagSets[i],
  }));
}

let mockPosts: CommunityPostData[] = generateMockPosts();

let mockInitialized = false;

// ==================== Public API ====================

/**
 * Configure the community service with a StorageEngine for persistence.
 * When called, any existing mock data is migrated to the storage backend.
 */
export async function configureCommunityPersistence(storage: StorageEngine): Promise<void> {
  communityStorage = storage;

  // Migrate mock data on first configuration
  if (!mockInitialized) {
    for (const post of mockPosts) {
      await storage.saveCommunityPost(post);
    }
    mockInitialized = true;
  }
}

/**
 * Get all community posts, most recent first.
 * Uses storage if configured, otherwise returns fallback mock data.
 */
export async function getPosts(): Promise<CommunityPostData[]> {
  if (communityStorage) {
    return communityStorage.loadCommunityPosts();
  }
  return [...mockPosts].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Get a single community post by ID.
 */
export async function getPost(id: string): Promise<CommunityPostData | null> {
  if (communityStorage) {
    return communityStorage.loadCommunityPost(id);
  }
  return mockPosts.find((p) => p.id === id) ?? null;
}

/**
 * Create a new community post.
 */
export async function createPost(
  id: string,
  userId: string,
  userName: string,
  content: string,
  tags: string[],
): Promise<CommunityPostData> {
  const post: CommunityPostData = {
    id,
    userId,
    userName,
    content,
    likes: 0,
    comments: 0,
    timestamp: new Date().toISOString(),
    tags,
  };

  if (communityStorage) {
    await communityStorage.saveCommunityPost(post);
  }
  mockPosts.unshift(post);
  return post;
}

/**
 * Like a community post.
 */
export async function likePost(postId: string): Promise<number> {
  if (communityStorage) {
    await communityStorage.likeCommunityPost(postId);
    // Reload to get updated count
    const post = await communityStorage.loadCommunityPost(postId);
    return post?.likes ?? 0;
  }
  const post = mockPosts.find((p) => p.id === postId);
  if (post) post.likes += 1;
  return post?.likes ?? 0;
}

/**
 * Reset the community service (for testing).
 */
export function resetCommunityService(): void {
  communityStorage = null;
  mockPosts = generateMockPosts();
  mockInitialized = false;
}

/**
 * Get the community storage engine (for testing).
 */
export function getCommunityStorage(): StorageEngine | null {
  return communityStorage;
}
