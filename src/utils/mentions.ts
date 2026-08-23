/**
 * ============================================================================
 * Toroloom — Mentions Parser
 * ============================================================================
 *
 * Parses @username mentions in post/comment content and returns structured
 * segments for rendering as tappable text.
 *
 * Usage:
 *   import { parseMentions, MentionSegment } from '../utils/mentions';
 *   const segments = parseMentions('Hey @priya great analysis!');
 *   // segments = [
 *   //   { type: 'text', text: 'Hey ' },
 *   //   { type: 'mention', text: '@priya', username: 'priya' },
 *   //   { type: 'text', text: ' great analysis!' },
 *   // ]
 * ============================================================================
 */

export type MentionSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; text: string; username: string };

/** Pattern: @ followed by 1-30 word characters (letters, digits, underscores) */
const MENTION_REGEX = /@([A-Za-z0-9_]{1,30})/g;

/**
 * Parse a string into segments separating plain text from @mentions.
 *
 * @param content - Raw post/comment content
 * @returns Array of segments — alternating text and mention segments
 */
export function parseMentions(content: string): MentionSegment[] {
  if (!content) return [];

  const segments: MentionSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    const username = match[1];

    // Text before the mention
    if (matchStart > lastIndex) {
      segments.push({ type: 'text', text: content.slice(lastIndex, matchStart) });
    }

    // The mention itself
    segments.push({ type: 'mention', text: match[0], username });

    lastIndex = matchEnd;
  }

  // Remaining text after last mention (or full text if no mentions)
  if (lastIndex < content.length) {
    segments.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return segments;
}

/**
 * Check if content contains any @mentions.
 */
export function hasMentions(content: string): boolean {
  MENTION_REGEX.lastIndex = 0;
  return MENTION_REGEX.test(content);
}

/**
 * Extract all mentioned usernames from content.
 */
export function extractMentionedUsers(content: string): string[] {
  const users: string[] = [];
  MENTION_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    users.push(match[1]);
  }
  return [...new Set(users)]; // deduplicate
}
