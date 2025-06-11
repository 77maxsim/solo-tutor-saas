// Avatar utility functions for rendering different avatar types

export const presetAvatarMap: Record<string, string> = {
  "preset-boy1": "👦",
  "preset-girl1": "👧", 
  "preset-boy2": "🧒",
  "preset-girl2": "👩",
  "preset-man": "👨",
  "preset-woman": "👩‍🦰",
  "emoji-star": "⭐",
  "emoji-rocket": "🚀",
  "emoji-book": "📚",
  "emoji-brain": "🧠",
};

export function getAvatarDisplay(avatarUrl?: string | null): {
  type: 'emoji' | 'image' | 'default';
  content: string;
} {
  if (!avatarUrl) {
    return { type: 'default', content: '' };
  }

  // Check if it's an HTTP URL (uploaded image)
  if (avatarUrl.startsWith('http')) {
    return { type: 'image', content: avatarUrl };
  }

  // Check if it's a preset emoji
  if (presetAvatarMap[avatarUrl]) {
    return { type: 'emoji', content: presetAvatarMap[avatarUrl] };
  }

  // Default fallback
  return { type: 'default', content: '' };
}