const extractFromJsonString = (str: string): string | null => {
  if (!str.startsWith('{') && !str.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const extracted = parsed.error || parsed.message || parsed.description;
      if (typeof extracted === 'string' && extracted.trim()) {
        return extracted.trim();
      }
    }
  } catch {
    // not valid JSON
  }
  return null;
};

export const formatClientErrorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (error instanceof Error && error.message) {
    const message = error.message.trim();

    if (message.toLowerCase().includes('failed to fetch') || message.toLowerCase().includes('networkerror')) {
      return 'Unable to connect to server. Please check your connection and try again.';
    }

    return extractFromJsonString(message) ?? message;
  }

  if (typeof error === 'string' && error.trim()) {
    const str = error.trim();
    return extractFromJsonString(str) ?? str;
  }

  return fallback;
};
