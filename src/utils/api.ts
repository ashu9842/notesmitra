import { projectId, publicAnonKey } from '/utils/supabase/info';
import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e033c1e9`;

// Create Supabase client for auth
const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

const getErrorField = (payload: unknown, field: 'error' | 'message') => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
};

const parseResponseData = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text ? { error: text } : null;
};

const formatApiErrorMessage = (status: number, payload: unknown) => {
  const serverMessage = getErrorField(payload, 'error') || getErrorField(payload, 'message');

  if (status === 401) return 'Your session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return serverMessage || 'Requested resource was not found.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Server is temporarily unavailable. Please try again shortly.';

  return serverMessage || `Request failed (${status})`;
};

// Helper to get auth headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || publicAnonKey;
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
};

// Helper for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const headers = await getAuthHeaders();
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Unable to connect to server. Please check your connection and try again.');
  }
  
  const data = await parseResponseData(response);
  
  if (!response.ok) {
    throw new Error(formatApiErrorMessage(response.status, data));
  }
  
  return data;
};

// ============ AUTH API ============

export const authAPI = {
  signUp: async (email: string, password: string, name: string, role: string = 'buyer') => {
    return apiCall('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
    });
  },
  
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },
  
  getProfile: async () => {
    return apiCall('/auth/profile');
  },
  
  switchRole: async (role: string) => {
    return apiCall('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },
};

// ============ NOTES API ============

export const notesAPI = {
  upload: async (formData: FormData) => {
    const headers = await getAuthHeaders();
    delete headers['Content-Type']; // Let browser set it for FormData
    let response: Response;
    
    try {
      response = await fetch(`${API_BASE_URL}/notes/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch {
      throw new Error('Unable to connect to server. Please check your connection and try again.');
    }
    
    const data = await parseResponseData(response);
    if (!response.ok) {
      throw new Error(formatApiErrorMessage(response.status, data));
    }
    
    return data;
  },
  
  getAll: async (filters?: {
    status?: string;
    subject?: string;
    semester?: string;
    sellerId?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiCall(`/notes${query}`);
  },
  
  getById: async (id: string) => {
    return apiCall(`/notes/${id}`);
  },
  
  review: async (id: string, status: string, adminNotes?: string) => {
    return apiCall(`/notes/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, adminNotes }),
    });
  },
  
  download: async (id: string) => {
    return apiCall(`/notes/${id}/download`);
  },
};

// ============ WALLET API ============

export const walletAPI = {
  get: async () => {
    return apiCall('/wallet');
  },
  
  addFunds: async (amount: number, paymentMethod: string) => {
    return apiCall('/wallet/add-funds', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethod }),
    });
  },
  
  withdraw: async (amount: number, method: string) => {
    return apiCall('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount, method }),
    });
  },
};

// ============ PAYMENT API ============

export const paymentAPI = {
  purchase: async (noteId: string, paymentMethod: string) => {
    return apiCall('/payments/purchase', {
      method: 'POST',
      body: JSON.stringify({ noteId, paymentMethod }),
    });
  },
  
  getPurchases: async () => {
    return apiCall('/payments/purchases');
  },
};

// ============ TICKETS API ============

export const ticketsAPI = {
  create: async (category: string, subject: string, message: string, relatedNoteId?: string) => {
    return apiCall('/tickets', {
      method: 'POST',
      body: JSON.stringify({ category, subject, message, relatedNoteId }),
    });
  },
  
  getAll: async () => {
    return apiCall('/tickets');
  },
  
  getById: async (id: string) => {
    return apiCall(`/tickets/${id}`);
  },
  
  reply: async (id: string, message: string) => {
    return apiCall(`/tickets/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },
  
  updateStatus: async (id: string, status?: string, priority?: string) => {
    return apiCall(`/tickets/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, priority }),
    });
  },
};

// ============ ADMIN API ============

export const adminAPI = {
  getStats: async () => {
    return apiCall('/admin/stats');
  },
};

export { supabase };
