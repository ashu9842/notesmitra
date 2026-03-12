// NotesMitra MERN Stack API Client

const _rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE_URL = _rawApiUrl.endsWith('/api') ? _rawApiUrl : `${_rawApiUrl}/api`;

// In cross-origin deployments (e.g. Vercel + Render), the CSRF cookie set by the
// server on onrender.com is NOT readable via document.cookie from vercel.app due to
// the Same-Origin Policy.  We store the token returned in auth response bodies and
// use it as the X-CSRF-Token header on state-changing requests.
let _csrfTokenMemory = '';

export const storeCsrfToken = (token: string) => {
  if (token) _csrfTokenMemory = token;
};

const getCsrfToken = () => {
  // Same-origin: cookie is directly readable
  const cookieMatch = document.cookie.match(/(?:^|; )csrfToken=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
  // Cross-origin: use the in-memory token obtained from the auth response body
  return _csrfTokenMemory;
};

// Fetch a fresh CSRF token from the server (called once on app init).
// This covers page-refresh scenarios where the in-memory token was cleared.
export const initCsrfToken = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/csrf-token`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      // successResponse returns a flat object: { success, csrfToken }
      if (data?.csrfToken) storeCsrfToken(data.csrfToken);
    }
  } catch {
    // non-critical — CSRF token will be obtained after next auth action
  }
};

// Helper to get auth headers
const getAuthHeaders = (method?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const normalizedMethod = method?.toUpperCase();
  if (normalizedMethod && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return headers;
};

type ApiResponsePayload = {
  error?: string;
  message?: string;
  code?: string;
};

const getPayloadField = (payload: unknown, field: keyof ApiResponsePayload) => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
};

const formatApiErrorMessage = (status: number, payload: unknown) => {
  const serverMessage = getPayloadField(payload, 'error') || getPayloadField(payload, 'message');

  if (status === 401) {
    // Credential failures return "Invalid credentials" from the server — show a helpful message.
    // Other 401s (expired/missing token) show the session-expired message.
    if (serverMessage && serverMessage.toLowerCase().includes('credential')) {
      return 'Incorrect email or password. Please try again.';
    }
    return 'Your session expired. Please sign in again.';
  }
  if (status === 403) return serverMessage || 'You do not have permission for this action.';
  if (status === 404) return serverMessage || 'Requested resource was not found.';
  if (status === 408) return 'Request timed out. Please try again.';
  if (status === 413) return 'File is too large. Please upload a smaller file.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 503) return '__SERVER_STARTING__';
  if (status >= 500) return 'Server is temporarily unavailable. Please try again shortly.';

  return serverMessage || `Request failed (${status})`;
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
  if (!text) return null;

  // Try to parse as JSON even if content-type was not set correctly
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
};

// Helper for API calls
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const method = options.method || 'GET';
  const headers = getAuthHeaders(method);
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
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
    return apiCall('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  adminSignIn: async (email: string, password: string) => {
    return apiCall('/auth/admin/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  signOut: async () => {
    return apiCall('/auth/logout', {
      method: 'POST'
    });
  },
  
  getSession: async () => {
    return apiCall('/auth/profile');
  },
  
  getProfile: async () => {
    return apiCall('/auth/profile');
  },
  
  updateProfile: async (name: string, email: string, phone?: string) => {
    return apiCall('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email, phone }),
    });
  },
  
  changePassword: async (currentPassword: string, newPassword: string) => {
    return apiCall('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// ============ RAZORPAY API ============

export const razorpayAPI = {
  getKey: async () => {
    return apiCall('/razorpay/key');
  },
  
  createWalletOrder: async (amount: number) => {
    return apiCall('/razorpay/create-order/wallet', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },
  
  verifyWalletPayment: async (razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string) => {
    return apiCall('/razorpay/verify-payment/wallet', {
      method: 'POST',
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    });
  },
  
  createPremiumOrder: async (amount: number) => {
    return apiCall('/razorpay/create-order/premium', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  verifyPremiumPayment: async (razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string) => {
    return apiCall('/razorpay/verify-payment/premium', {
      method: 'POST',
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    });
  },

  createNoteOrder: async (noteId: string) => {
    return apiCall('/razorpay/create-order/note', {
      method: 'POST',
      body: JSON.stringify({ noteId }),
    });
  },
  
  verifyNotePayment: async (noteId: string, razorpay_order_id: string, razorpay_payment_id: string, razorpay_signature: string) => {
    return apiCall('/razorpay/verify-payment/note', {
      method: 'POST',
      body: JSON.stringify({ noteId, razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    });
  },
};

// ============ NOTES API ============

export const notesAPI = {
  upload: async (formData: FormData) => {
    const csrfToken = getCsrfToken();
    
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/notes/upload`, {
        method: 'POST',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken })
        },
        credentials: 'include',
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
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiCall(`/notes${query}`);
  },
  
  getById: async (id: string) => {
    return apiCall(`/notes/${id}`);
  },
  
  preview: async (id: string) => {
    return apiCall(`/notes/${id}/preview`);
  },

  rate: async (id: string, rating: number, comment?: string) => {
    return apiCall(`/notes/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment })
    });
  },
  
  review: async (id: string, status: string, adminNotes?: string) => {
    return apiCall(`/notes/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, adminNotes }),
    });
  },
  
  download: async (id: string) => {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/notes/${id}/download`, {
        credentials: 'include'
      });
    } catch {
      throw new Error('Unable to connect to server. Please check your connection and try again.');
    }
    
    if (!response.ok) {
      const data = await parseResponseData(response);
      throw new Error(formatApiErrorMessage(response.status, data));
    }

    const counted = response.headers.get('X-Download-Counted') === '1';
    
    // Server streams the PDF bytes directly (both Cloudinary and local storage)
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note_${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return { success: true, counted };
  },
  
  delete: async (id: string) => {
    return apiCall(`/notes/${id}`, {
      method: 'DELETE',
    });
  },

  getAISummary: async (id: string) => {
    return apiCall(`/notes/${id}/ai-summary`);
  },

  aiChat: async (id: string, question: string, history: { role: 'user' | 'assistant'; content: string }[]) => {
    return apiCall(`/notes/${id}/ai-chat`, {
      method: 'POST',
      body: JSON.stringify({ question, history }),
    });
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
  
  getTransactions: async () => {
    return apiCall('/wallet/transactions');
  },

  getPendingWithdrawals: async () => {
    return apiCall('/wallet/admin/pending-withdrawals');
  },

  completeWithdrawal: async (walletId: string, txnId: string) => {
    return apiCall('/wallet/admin/complete-withdrawal', {
      method: 'POST',
      body: JSON.stringify({ walletId, txnId }),
    });
  },
};

// ============ PAYMENT API ============

export const paymentAPI = {
  purchase: async (noteId: string, paymentMethod: string) => {
    const idempotencyKey = `${noteId}-${paymentMethod}-${Date.now()}`;
    return apiCall('/payments/purchase', {
      method: 'POST',
      body: JSON.stringify({ noteId, paymentMethod }),
      headers: { 'x-idempotency-key': idempotencyKey },
    });
  },
  
  getPurchases: async () => {
    return apiCall('/payments/purchases');
  },
  
  getSales: async () => {
    return apiCall('/payments/sales');
  },
  
  getPurchase: async (id: string) => {
    return apiCall(`/payments/purchases/${id}`);
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

  guestCreate: async (guestName: string, guestEmail: string, category: string, subject: string, message: string) => {
    return apiCall('/tickets/guest', {
      method: 'POST',
      body: JSON.stringify({ guestName, guestEmail, category, subject, message }),
    });
  },

  getAll: async (filters?: { status?: string; priority?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiCall(`/tickets${query}`);
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
      method: 'PUT',
      body: JSON.stringify({ status, priority }),
    });
  },
  
  delete: async (id: string) => {
    return apiCall(`/tickets/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============ ADMIN API ============

export const adminAPI = {
  getStats: async () => {
    return apiCall('/admin/stats');
  },
  
  getAllUsers: async (filters?: { role?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiCall(`/admin/users${query}`);
  },
  
  updateUserStatus: async (userId: string, isActive?: boolean, role?: string) => {
    return apiCall(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive, role }),
    });
  },
  
  deleteUser: async (userId: string) => {
    return apiCall(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  },
  
  getFullPDFUrl: async (noteId: string) => {
    return apiCall(`/notes/${noteId}/admin-view`);
  }
};

// ============ PREMIUM SUBSCRIPTION API ============

export const premiumAPI = {
  // Get all available plans
  getPlans: async () => {
    return apiCall('/premium/plans');
  },
  
  // Get current user's subscription
  getMySubscription: async () => {
    return apiCall('/premium/my-subscription');
  },
  
  // Subscribe to a plan
  subscribe: async (planType: string, billingCycle: string = 'monthly') => {
    return apiCall('/premium/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planType, billingCycle }),
    });
  },
  
  // Activate subscription after payment
  activateSubscription: async (subscriptionId: string, transactionId: string, paymentMethod: string) => {
    return apiCall(`/premium/activate/${subscriptionId}`, {
      method: 'POST',
      body: JSON.stringify({ transactionId, paymentMethod }),
    });
  },
  
  // Cancel subscription
  cancelSubscription: async () => {
    return apiCall('/premium/cancel', {
      method: 'POST',
    });
  },
  
  // Get subscription stats
  getStats: async () => {
    return apiCall('/premium/stats');
  },
};

// Export helpers
export { API_BASE_URL };
