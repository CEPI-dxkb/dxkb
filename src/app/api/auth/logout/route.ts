import { NextRequest, NextResponse } from 'next/server';
import { useCallback } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';

export async function POST(request: NextRequest) {
  // BV-BRC doesn't seem to have a logout endpoint
  // Just return success
  return NextResponse.json({ success: true });
}

// hooks/useAuthenticatedFetch.ts
export function useAuthenticatedFetch() {
  const { user, refreshAuth } = useAuth();

  return useCallback(async (url: string, options: RequestInit = {}) => {
    if (!user?.token) {
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      'Authorization': user.token,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If token expired, try to refresh
    if (response.status === 401) {
      await refreshAuth();
      // Retry with new token
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': user.token,
        },
      });
      return retryResponse;
    }

    return response;
  }, [user, refreshAuth]);
}