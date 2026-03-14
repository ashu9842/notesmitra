import { useState, useEffect, lazy, Suspense } from "react";
import { FileText, LogIn, LogOut, Shield, UserCircle, ShoppingBag, Settings, MessageSquare, Download, TrendingUp, Award, Clock, Sparkles, Star, Zap, ArrowLeft, Menu, X, Sun, Moon } from "lucide-react";
const logoImage = "/logo.svg";
import { Toaster } from "./components/ui/sonner";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { toast } from "sonner";
import SocketClient from "../utils/socketClient";
import { useTicketUpdates, getTicketUpdateNotification } from "../utils/useTicketUpdates";
import { authAPI, adminAPI, notesAPI, paymentAPI, premiumAPI, ticketsAPI, walletAPI, razorpayAPI, storeCsrfToken, initCsrfToken } from "../utils/api-mern";
import { formatClientErrorMessage } from "../utils/errorMessages";
import { sendFirebaseVerificationEmail, checkFirebaseEmailVerified, resendFirebaseVerificationEmail, completeFirebasePasswordReset } from "../utils/firebase";
import "../styles/index.css";

// Critical path — needed for initial render / auth flows
import { AuthDialog } from "./components/AuthDialog";
import { AdminLoginDialog } from "./components/AdminLoginDialog";

// Lazy-loaded — only needed after login or explicit tab navigation
const ChangePassword       = lazy(() => import("./components/ChangePassword").then(m => ({ default: m.ChangePassword })));
const ResetPasswordDialog  = lazy(() => import("./components/ResetPasswordDialog").then(m => ({ default: m.ResetPasswordDialog })));
const TermsAndConditions   = lazy(() => import("./components/TermsAndConditions").then(m => ({ default: m.TermsAndConditions })));
const SellerDashboard      = lazy(() => import("./components/SellerDashboard").then(m => ({ default: m.SellerDashboard })));
const BuyerMarketplace     = lazy(() => import("./components/BuyerMarketplace").then(m => ({ default: m.BuyerMarketplace })));
const AdminReview          = lazy(() => import("./components/AdminReview").then(m => ({ default: m.AdminReview })));
const Wallet               = lazy(() => import("./components/Wallet").then(m => ({ default: m.Wallet })));
const SellerPremiumPlans   = lazy(() => import("./components/SellerPremiumPlans").then(m => ({ default: m.SellerPremiumPlans })));
const BuyerPremiumPlans    = lazy(() => import("./components/BuyerPremiumPlans").then(m => ({ default: m.BuyerPremiumPlans })));
const Support              = lazy(() => import("./components/Support").then(m => ({ default: m.Support })));
const AdminQueries         = lazy(() => import("./components/AdminQueries").then(m => ({ default: m.AdminQueries })));
const Downloads            = lazy(() => import("./components/Downloads").then(m => ({ default: m.Downloads })));
const PremiumPaymentDialog = lazy(() => import("./components/PremiumPaymentDialog").then(m => ({ default: m.PremiumPaymentDialog })));
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog";

export interface Note {
  id: string;
  description?: string;
  sellerId: string;
  sellerName: string;
  title: string;
  subject: string;
  course: string;
  price: number;
  pages?: number;
  fileType: "pdf" | "image";
  uploadDate: string;
  status: "pending_review" | "approved" | "rejected" | "failed_quality_check";
  qualityChecks?: {
    pageCount?: boolean;
    fileSize?: boolean;
    fileType?: boolean;
    hasTitle?: boolean;
    hasDescription?: boolean;
    copyrightCheck?: boolean;
    blankPageCheck?: boolean;
    qualityCheck?: boolean;
    metadataCheck?: boolean;
    duplicateCheck?: boolean;
  };
  rejectionReason?: string;
  adminNotes?: string;
  sold?: boolean;
  earnings?: number;
  rating?: number;
  downloads?: number;
  ratings?: { userId: string; rating: number; comment?: string; date: string }[];
  featured?: {
    active: boolean;
    expiryDate?: string;
    plan?: "7days" | "30days";
  };
  isFeatured?: boolean;
  isPriorityApproval?: boolean;
  sellerSubscriptionType?: string;
}

interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: string;
  status: "completed" | "pending";
}

interface User {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  role: "seller" | "buyer" | "admin";
  purchasedNotes?: string[];
  isEmailVerified?: boolean;
  sellerPremium?: {
    active: boolean;
    expiryDate?: string;
  };
  buyerPremium?: {
    active: boolean;
    expiryDate?: string;
  };
  monthlyUploads?: number;
  lastUploadReset?: string;
}

export default function App() {
  const showErrorToast = (error: unknown, fallback: string) => {
    toast.error(formatClientErrorMessage(error, fallback));
  };

  const mapUserFromApi = (user: any): User => {
    const isBuyerPremium = Boolean(user?.isPremiumBuyer || user?.subscriptionType === 'combo');
    const isSellerPremium = Boolean(user?.isPremiumSeller || user?.subscriptionType === 'combo');

    return {
      id: user._id || user.id,   // backend returns 'id', not '_id'
      email: user.email,
      name: user.name,
      phone: user.phone || undefined,
      role: user.role || "buyer",
      purchasedNotes: user.purchasedNotes || [],
      isEmailVerified: user.isEmailVerified == null ? undefined : Boolean(user.isEmailVerified),
      sellerPremium: {
        active: isSellerPremium,
        expiryDate: user.subscriptionExpiry || undefined
      },
      buyerPremium: {
        active: isBuyerPremium,
        expiryDate: user.subscriptionExpiry || undefined
      },
      monthlyUploads: user.monthlyUploadsCount || 0,
      lastUploadReset: user.lastUploadReset || undefined
    };
  };

  const mapNoteFromApi = (note: any): Note => ({
    id: note._id || note.id,
    description: note.description,
    sellerId: note.sellerId?._id || note.sellerId,
    sellerName: note.sellerName || note.sellerId?.name || "Unknown",
    title: note.title,
    subject: note.subject,
    course: note.semester || note.course || "",
    price: note.price,
    pages: note.pages,
    fileType: "pdf",
    uploadDate: note.createdAt || note.uploadedAt || new Date().toISOString(),
    status: note.status,
    qualityChecks: note.qualityChecks,
    adminNotes: note.adminNotes,
    rejectionReason: note.rejectionReason,
    rating: note.rating,
    downloads: note.downloads,
    isFeatured: Boolean(note.isFeatured),
    isPriorityApproval: Boolean(note.isPriorityApproval),
    sellerSubscriptionType: note.sellerSubscriptionType || 'free_seller'
  });
  // Set document title and meta tags for mobile devices
  useEffect(() => {
    // Set document title
    document.title = "NotesMitra - Learn Smarter Together";
    
    // Add or update meta tags for mobile/PWA
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let meta = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      
      meta.setAttribute("content", content);
    };

    // Meta tags for mobile devices
    updateMetaTag("application-name", "NotesMitra");
    updateMetaTag("apple-mobile-web-app-title", "NotesMitra");
    updateMetaTag("apple-mobile-web-app-capable", "yes");
    updateMetaTag("apple-mobile-web-app-status-bar-style", "default");
    updateMetaTag("mobile-web-app-capable", "yes");
    
    // Description
    updateMetaTag("description", "India's #1 Academic Notes Marketplace. Buy and sell quality study notes. Trusted by thousands of students.");
    
    // Theme color for mobile browsers
    updateMetaTag("theme-color", "#2563eb");
    updateMetaTag("msapplication-TileColor", "#2563eb");
    
    // Open Graph tags for social sharing
    updateMetaTag("og:title", "NotesMitra - Learn Smarter Together", true);
    updateMetaTag("og:description", "India's #1 Academic Notes Marketplace. Buy and sell quality study notes.", true);
    updateMetaTag("og:type", "website", true);
    updateMetaTag("og:site_name", "NotesMitra", true);
    
    // Twitter Card tags
    updateMetaTag("twitter:card", "summary_large_image");
    updateMetaTag("twitter:title", "NotesMitra - Learn Smarter Together");
    updateMetaTag("twitter:description", "India's #1 Academic Notes Marketplace. Buy and sell quality study notes.");
  }, []);

  // ── Content Protection ──────────────────────────────────────────────────────
  // Disable right-click, common dev-tools shortcuts, and drag on the whole app.
  // This is a UX deterrent — determined attackers can bypass client-side guards,
  // so the real security is server-side (auth-gated endpoints + watermarks).
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Block right-click on images and inside any PDF/note content area
      if (
        target.tagName === 'IMG' ||
        target.tagName === 'IFRAME' ||
        target.closest('[data-protected]')
      ) {
        e.preventDefault();
      }
    };

    const blockShortcuts = (e: KeyboardEvent) => {
      const k = e.key;
      // F12 — DevTools
      if (k === 'F12') { e.preventDefault(); return; }
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+S (save), Ctrl+P (print), Ctrl+U (view source)
        if (['s', 'S', 'p', 'P', 'u', 'U'].includes(k)) { e.preventDefault(); return; }
        // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (console), Ctrl+Shift+C (inspector)
        if (e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(k)) { e.preventDefault(); return; }
      }
    };

    const blockDrag = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' || target.closest('[data-protected]')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('keydown', blockShortcuts);
    document.addEventListener('dragstart', blockDrag);
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('keydown', blockShortcuts);
      document.removeEventListener('dragstart', blockDrag);
    };
  }, []);

  // Initialise theme & font size from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('nm-theme');
    const savedSize = localStorage.getItem('nm-font-size');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
    if (savedSize) {
      const size = parseInt(savedSize, 10);
      setFontSize(size);
      document.documentElement.style.setProperty('--font-size', `${size}px`);
      document.documentElement.style.fontSize = `${size}px`;
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nm-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nm-theme', 'light');
    }
  };

  const FONT_SIZES = [14, 16, 18] as const;
  const changeFontSize = (delta: 1 | -1) => {
    const idx = FONT_SIZES.indexOf(fontSize as 14 | 16 | 18);
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
    const next = FONT_SIZES[nextIdx];
    if (next === fontSize) return;
    setFontSize(next);
    document.documentElement.style.setProperty('--font-size', `${next}px`);
    document.documentElement.style.fontSize = `${next}px`;
    localStorage.setItem('nm-font-size', String(next));
  };

  const [notes, setNotes] = useState<Note[]>([]);           // marketplace: always status=approved
  const [sellerOwnNotes, setSellerOwnNotes] = useState<Note[]>([]); // seller's own notes (all statuses)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(null);
  const [firebaseResetToken, setFirebaseResetToken] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showPremiumPayment, setShowPremiumPayment] = useState(false);
  const [premiumPaymentData, setPremiumPaymentData] = useState<PremiumPaymentPayload | null>(null);
  const [activeRole, setActiveRole] = useState<"seller" | "buyer" | "admin" | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Theme & Font Size
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState(16); // 14 | 16 | 18

  const [purchasedNotes, setPurchasedNotes] = useState<string[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletWithdrawableBalance, setWalletWithdrawableBalance] = useState<number | null>(null);
  const [adminWalletBalance, setAdminWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Admin transactions (separate from seller transactions)
  const [adminTransactions, setAdminTransactions] = useState<Transaction[]>([]);
  const [isLoadingAdminStats, setIsLoadingAdminStats] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<any | null>(null);

  // Pending withdrawals (admin view)
  interface PendingWithdrawal {
    txnId: string;
    walletId: string;
    userId: string;
    sellerName: string;
    sellerEmail: string;
    amount: number;
    upiId: string;
    requestedAt: string;
  }
  const [pendingWithdrawals, setPendingWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false);
  const [completingTxnId, setCompletingTxnId] = useState<string | null>(null);

  // Admin users list
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersTotalCount, setAdminUsersTotalCount] = useState(0);
  const [isLoadingAdminUsers, setIsLoadingAdminUsers] = useState(false);
  const [adminUsersSearch, setAdminUsersSearch] = useState('');
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);

  // Support tickets state
  interface SupportTicket {
    id: string;
    userName: string;
    userEmail: string;
    issueType: string;
    description: string;
    status: "pending" | "in-progress" | "resolved";
    date: string;
  }

  interface PremiumPaymentPayload {
    planType: "seller" | "buyer" | "combo";
    planName: string;
    amount: number;
    onSuccess: (paymentId: string, method: "wallet" | "razorpay") => void;
  }

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);

  const [buyerStats, setBuyerStats] = useState({ totalPurchases: 0, totalSpent: 0 });
  const [sellerStats, setSellerStats] = useState({
    totalSales: 0,
    totalEarnings: 0,
    totalNotes: 0,
    approvedNotes: 0,
    pendingNotes: 0,
    rejectedNotes: 0,
    totalDownloads: 0
  });
  const [isLoadingBuyerStats, setIsLoadingBuyerStats] = useState(false);
  const [isLoadingSellerStats, setIsLoadingSellerStats] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Restore view state when currentUser is set (login or page-refresh auto-login).
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'admin') {
      setActiveRole('admin');
      setIsAdminLoggedIn(true);
      loadNotes(); // admin needs all notes (no status filter)
    } else {
      // seller / buyer — default to seller view so dashboard is immediately visible
      if (!activeRole) setActiveRole('seller');
      loadSellerOwnNotes(); // load their own notes (all statuses) for seller dashboard
    }
  }, [currentUser]);

  // Socket.IO setup for real-time admin stats updates
  useEffect(() => {
    if (!isAdminLoggedIn) {
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketClient = new SocketClient(socketUrl);

    // Initialize socket connection
    socketClient
      .connect('')  // No token needed for this simple setup
      .then(() => {
        // Listen for admin stats updates
        socketClient.on('admin:stats:update', (stats: any) => {
          if (stats) {
            setAdminStats((prev: any) => ({ ...(prev || {}), ...stats }));
            if (stats.platformWalletBalance !== undefined && stats.platformWalletBalance !== null) {
              const platformBal = Number(stats.platformWalletBalance);
              if (Number.isFinite(platformBal)) {
                setAdminWalletBalance(platformBal);
              }
            }
          }
        });
      })
      .catch((error: any) => {
      });

    // Cleanup on logout
    return () => {
      socketClient.disconnect();
    };
  }, [isAdminLoggedIn]);

  // Socket.IO setup for real-time ticket updates
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const socketClient = new SocketClient(socketUrl);

    socketClient
      .connect()
      .then(() => {
        // Listen for ticket:update events
        socketClient.on('ticket:update', (event: any) => {
          // Get notification content based on event type
          const notification = getTicketUpdateNotification(event);
          
          // Show toast notification
          if (event.action === 'admin_replied' || event.action === 'status_changed' || event.action === 'ticket_deleted') {
            toast.info(notification.message, {
              description: notification.title,
              duration: 5000
            });
          }
        });
      })
      .catch((error: any) => {
      });

    return () => {
      socketClient.disconnect();
    };
  }, [currentUser]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken     = urlParams.get('resetToken');
    const firebaseVerify = urlParams.get('firebaseVerify');
    const passwordReset  = urlParams.get('passwordReset');

    if (resetToken || firebaseVerify || passwordReset) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Firebase email-link password reset — complete the sign-in and get an ID token
    if (passwordReset === '1') {
      completeFirebasePasswordReset().then(result => {
        if (result?.idToken) {
          setFirebaseResetToken(result.idToken);
        } else {
          toast.error('Reset link is invalid or expired. Please request a new one.');
        }
      }).catch(() => {
        toast.error('Reset link is invalid or expired. Please request a new one.');
      });
    }

    const loadProfile = async () => {
      try {
        const data = await authAPI.getProfile();
        if (data?.user) {
          let mappedUser = mapUserFromApi(data.user);

          // User just clicked the Firebase verification link — try to sync immediately
          if (firebaseVerify && !mappedUser.isEmailVerified) {
            try {
              const { auth } = await import('../utils/firebase');
              const fbUser = auth.currentUser;
              if (fbUser) {
                await fbUser.reload();
                if (auth.currentUser?.emailVerified) {
                  const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';
                  const r = await fetch(`${apiBase}/auth/confirm-email-verified`, { method: 'POST', credentials: 'include' });
                  if (r.ok) {
                    mappedUser = { ...mappedUser, isEmailVerified: true };
                    toast.success('Email verified! You now have full access.');
                  }
                }
              } else {
                toast.success('Email verified! Log in again if the banner is still showing.');
              }
            } catch {
              // sync failed — banner will disappear on next login
            }
          }

          setCurrentUser(mappedUser);
          setIsLoggedIn(true);
          setPurchasedNotes(mappedUser.purchasedNotes || []);
        } else if (firebaseVerify) {
          toast.success('Email verified! Please sign in to activate your account.');
        }
      } catch (err: any) {
        // Ignore 503 (server starting) and 401 (no session) — both are expected on cold load
        if (err?.message !== '__SERVER_STARTING__' && firebaseVerify) {
          toast.success('Email verified! Please sign in to activate your account.');
        }
      }
    };

    // Retry profile load if server is still warming up (503)
    const loadProfileWithRetry = async (retryCount = 0): Promise<void> => {
      try {
        await loadProfile();
      } catch (err: any) {
        if (err?.message === '__SERVER_STARTING__' && retryCount < 6) {
          setTimeout(() => loadProfileWithRetry(retryCount + 1), 5000);
        }
      }
    };

    loadProfileWithRetry();
    // Fetch a fresh CSRF token so cross-origin POST requests work before login.
    initCsrfToken();

    if (resetToken) {
      setResetPasswordToken(resetToken);
    }
  }, []);

  // Loads marketplace notes — always status=approved regardless of who is logged in.
  // Admin is the exception: they need all statuses for the review panel.
  const loadNotes = async (retryCount = 0): Promise<void> => {
    setIsLoadingNotes(true);
    setNotesError(null);
    try {
      const filters: any = {};
      if (currentUser?.role !== 'admin') {
        filters.status = 'approved'; // marketplace only shows approved notes
      } else {
        filters.limit = 200; // admin needs all notes for review panel
      }
      const data = await notesAPI.getAll(filters);
      const items = (data.notes || []).map(mapNoteFromApi);
      setNotes(items);
    } catch (error: any) {
      const message: string = error.message || 'Failed to load notes';
      // Server is still starting up (DB not ready yet) — retry silently up to 6×
      if (message === '__SERVER_STARTING__' && retryCount < 6) {
        setTimeout(() => loadNotes(retryCount + 1), 5000);
        return; // keep the loading spinner, don't show error
      }
      const displayMessage = message === '__SERVER_STARTING__'
        ? 'Server is starting up. Please refresh in a moment.'
        : message;
      setNotesError(displayMessage);
      showErrorToast(displayMessage, 'Failed to load notes');
    } finally {
      setIsLoadingNotes(false);
    }
  };

  // Loads the logged-in seller's own notes (all statuses) for the seller dashboard.
  const loadSellerOwnNotes = async () => {
    if (!currentUser?.id) return;
    try {
      const data = await notesAPI.getAll({ sellerId: currentUser.id, limit: 500 });
      setSellerOwnNotes((data.notes || []).map(mapNoteFromApi));
    } catch {
      // non-critical — seller dashboard degrades gracefully
    }
  };

  const loadWallet = async () => {
    setIsLoadingWallet(true);
    setWalletError(null);
    try {
      const data = await walletAPI.get();
      const balance = data.wallet?.balance || 0;
      setWalletBalance(balance);
      const available = Number(data.withdrawableBalance ?? balance);
      setWalletWithdrawableBalance(Number.isFinite(available) ? available : balance);
      if (currentUser?.role === "admin") {
        setAdminWalletBalance(balance);
      }
    } catch (error: any) {
      setWalletWithdrawableBalance(null);
      if (currentUser) {
        const raw = error.message || "Failed to load wallet";
        const message = raw === '__SERVER_STARTING__' ? 'Server is starting up. Please refresh in a moment.' : raw;
        setWalletError(message);
        showErrorToast(message, "Failed to load wallet");
      }
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await walletAPI.getTransactions();
      setTransactions((data.transactions || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: t.timestamp || t.date,
        status: t.status || "completed"
      })));
    } catch (error: any) {
      // Ignore for guests
    }
  };

  const loadPurchases = async () => {
    setIsLoadingBuyerStats(true);
    setAnalyticsError(null);
    try {
      const data = await paymentAPI.getPurchases();
      const purchases = data.purchases || [];
      // Only count unique, completed purchases
      const completedPurchases = purchases.filter((purchase: any) => purchase.status === 'completed');
      const completedNoteIds = completedPurchases.map((purchase: any) => purchase.noteId?._id || purchase.noteId);
      const uniqueCompletedNoteIds = Array.from(new Set(completedNoteIds));
      setPurchasedNotes(prev => Array.from(new Set([...prev, ...uniqueCompletedNoteIds])));

      const totalSpent = purchases.reduce((sum: number, purchase: any) => sum + Number(purchase.amount || 0), 0);
      setBuyerStats({ totalPurchases: uniqueCompletedNoteIds.length, totalSpent });
    } catch (error: any) {
      if (currentUser) {
        setAnalyticsError(formatClientErrorMessage(error, "Failed to load buyer analytics"));
      }
    } finally {
      setIsLoadingBuyerStats(false);
    }
  };

  const loadAdminStats = async () => {
    setIsLoadingAdminStats(true);
    setAdminStatsError(null);
    try {
      const data = await adminAPI.getStats();
      setAdminStats(data.stats || null);
      const platformWalletBalance = Number(data.stats?.platformWalletBalance ?? data.stats?.totalRevenue ?? 0);
      setAdminWalletBalance(platformWalletBalance);

      // Use full platform wallet transactions if available, else fall back to recentPurchases
      const walletTxns: any[] = data.stats?.platformWalletTransactions || [];
      if (walletTxns.length > 0) {
        setAdminTransactions(walletTxns.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          date: t.timestamp || new Date().toISOString(),
          status: t.status || "completed"
        })));
      } else {
        const recentPurchases = data.stats?.recentPurchases || [];
        setAdminTransactions(recentPurchases.map((purchase: any) => ({
          id: purchase._id || purchase.id,
          type: "credit",
          amount: purchase.platformFee || 0,
          description: `Platform Fee (2%+20%): ${purchase.noteId?.title || "Note"}`,
          date: purchase.createdAt || new Date().toISOString(),
          status: purchase.status || "completed"
        })));
      }
    } catch (error: any) {
      const message = error.message || "Failed to load admin stats";
      setAdminStatsError(message);
      showErrorToast(message, "Failed to load admin stats");
    } finally {
      setIsLoadingAdminStats(false);
    }
  };

  const loadSellerStats = async () => {
    if (!currentUser?.id) return;
    setIsLoadingSellerStats(true);
    setAnalyticsError(null);

    try {
      const data = await paymentAPI.getSales();
      const totalSales = Number(data.totalSales ?? data.count ?? 0);
      const totalEarnings = Number(data.totalEarnings || 0);
      const totalDownloadsFromApi = Number(data.totalDownloads);

      // Use sellerOwnNotes (all statuses) — not the marketplace notes (approved-only)
      const approvedNotes = sellerOwnNotes.filter(note => note.status === "approved").length;
      const pendingNotes = sellerOwnNotes.filter(note => note.status === "pending_review").length;
      const rejectedNotes = sellerOwnNotes.filter(note => note.status === "rejected" || note.status === "failed_quality_check").length;

      const totalDownloads = Number.isFinite(totalDownloadsFromApi)
        ? totalDownloadsFromApi
        : sellerOwnNotes.reduce((sum, n) => sum + (n.downloads || 0), 0);

      setSellerStats({
        totalSales,
        totalEarnings,
        totalNotes: sellerOwnNotes.length,
        approvedNotes,
        pendingNotes,
        rejectedNotes,
        totalDownloads
      });
    } catch (error: any) {
      setAnalyticsError(formatClientErrorMessage(error, "Failed to load seller analytics"));
    } finally {
      setIsLoadingSellerStats(false);
    }
  };

  const loadTickets = async () => {
    setIsLoadingTickets(true);
    setTicketsError(null);
    try {
      const data = await ticketsAPI.getAll();
      const tickets = data.tickets || [];
      setSupportTickets(tickets.map((ticket: any) => ({
        id: ticket._id,
        userName: ticket.userId?.name || ticket.userId?.email || "Unknown User",
        userEmail: ticket.userId?.email || "",
        issueType: ticket.category || ticket.subject,
        description: ticket.messages?.[0]?.message || "",
        status: ticket.status === "open" ? "pending" : ticket.status === "resolved" || ticket.status === "closed" ? "resolved" : "in-progress",
        date: ticket.createdAt
      })));
    } catch (error: any) {
      if (currentUser) {
        const raw = error.message || "Failed to load tickets";
        const message = raw === '__SERVER_STARTING__' ? 'Server is starting up. Please refresh in a moment.' : raw;
        setTicketsError(message);
        showErrorToast(message, "Failed to load tickets");
      }
    } finally {
      setIsLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setWalletBalance(0);
      setWalletWithdrawableBalance(null);
      setTransactions([]);
      setPurchasedNotes([]);
      setSupportTickets([]);
      setAdminTransactions([]);
      setAdminWalletBalance(0);
      return;
    }

    loadWallet();
    loadTransactions();
    loadPurchases();
    loadTickets();

    if (currentUser.role === "admin") {
      loadAdminStats();
    }

    if (currentUser.role === "seller") {
      loadSellerStats();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === "seller") {
      loadSellerStats();
    }
  }, [sellerOwnNotes]);

  const handleLogin = async (email: string, password: string, name?: string) => {
    try {
      const data = name
        ? await authAPI.signUp(email, password, name, "seller")
        : await authAPI.signIn(email, password);

      if (!data?.user) {
        showErrorToast("Authentication failed. Please try again.", "Authentication failed. Please try again.");
        return;
      }

      // Store CSRF token returned in the response body (required for cross-origin deployments
      // where document.cookie can't read the token set by the separate API origin).
      if (data.csrfToken) storeCsrfToken(data.csrfToken);

      let mappedUser = mapUserFromApi(data.user);

      if (name) {
        // Signup: create Firebase user and send verification email via Firebase
        sendFirebaseVerificationEmail(email, password); // fire-and-forget
        toast.success(`Welcome ${name}! Check your email to verify your account.`);
      } else {
        // Login: sync Firebase email-verified status to backend if needed.
        // null = old user (needsEmailVerification:false in DB) → no banner, skip Firebase check.
        // false = new user who hasn't verified yet → check Firebase.
        if (mappedUser.isEmailVerified === false) {
          const firebaseVerified = await checkFirebaseEmailVerified(email, password);
          if (firebaseVerified === true) {
            // Verified in Firebase — sync to backend DB
            try {
              const apiBase = (import.meta.env.VITE_API_URL as string) || 'http://localhost:5000/api';
              await fetch(`${apiBase}/auth/confirm-email-verified`, { method: 'POST', credentials: 'include' });
              mappedUser = { ...mappedUser, isEmailVerified: true };
            } catch { /* non-critical */ }
          }
          // firebaseVerified === false or null → banner stays (haven't clicked the link yet)
        } else if (mappedUser.isEmailVerified === true) {
          // Keep Firebase session alive so auth.currentUser is available for resend
          checkFirebaseEmailVerified(email, password).catch(() => {});
        }
        toast.success(`Welcome back, ${mappedUser.name}!`);
      }

      setCurrentUser(mappedUser);
      setIsLoggedIn(true);
      setPurchasedNotes(mappedUser.purchasedNotes || []);
      setShowAuthDialog(false);
      // Auto-select view based on role so user doesn't see a blank screen after login
      if (mappedUser.role === 'admin') setActiveRole('admin');
      else setActiveRole('seller');
    } catch (error: any) {
      showErrorToast(error, "Authentication failed. Please try again.");
    }
  };

  const handleGoogleLogin = (user: any) => {
    const mappedUser = mapUserFromApi(user);
    setCurrentUser(mappedUser);
    setIsLoggedIn(true);
    setPurchasedNotes(mappedUser.purchasedNotes || []);
    if (mappedUser.role === 'admin') setActiveRole('admin');
    else setActiveRole('seller');
    toast.success(`Welcome, ${mappedUser.name}!`);
  };

  const handleLogout = async () => {
    try {
      await authAPI.signOut();
    } catch (error: any) {
      showErrorToast(error, "Logout failed. Please try again.");
    } finally {
      setCurrentUser(null);
      setIsLoggedIn(false);
      setIsAdminLoggedIn(false);
      setAdminUsername("");
      setPurchasedNotes([]);
      setActiveRole(null);
      toast.success("Logged out successfully");
    }
  };

  const handleAdminLogin = (userData: any) => {
    setIsAdminLoggedIn(true);
    setAdminUsername(userData?.name || userData?.email || "Admin");
    setActiveRole("admin");
    const mappedUser = mapUserFromApi(userData);
    setCurrentUser(mappedUser);
  };

  const handleAdminLogout = async () => {
    try {
      await authAPI.signOut();
    } catch {
      // Cookie-clear errors are non-fatal; proceed with client-side logout
    } finally {
      setCurrentUser(null);
      setIsLoggedIn(false);
      setIsAdminLoggedIn(false);
      setAdminUsername("");
      setActiveRole(null);
      setPurchasedNotes([]);
      toast.success("Admin logged out successfully");
    }
  };

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const response = await authAPI.changePassword(currentPassword, newPassword);
    if (response?.success) {
      toast.success("Password changed successfully");
    } else {
      throw new Error(response?.error || "Failed to change password");
    }
  };

  const handleUploadNote = async (payload: FormData) => {
    const data = await notesAPI.upload(payload);
    if (data?.note) {
      await Promise.all([loadNotes(), loadSellerOwnNotes()]);
    }
    return data;
  };

  const handleApproveNote = async (noteId: string) => {
    await notesAPI.review(noteId, "approved", "Approved by admin");
    await loadNotes();
  };

  const handleRejectNote = async (noteId: string, reason: string) => {
    await notesAPI.review(noteId, "rejected", reason);
    await loadNotes();
  };

  const handlePurchase = async (noteId: string) => {
    setPurchasedNotes(prev => (prev.includes(noteId) ? prev : [...prev, noteId]));
    await Promise.all([loadPurchases(), loadNotes(), loadWallet()]);
  };

  const handleWithdraw = async (amount: number, upiId: string) => {
    await walletAPI.withdraw(amount, upiId);
    await loadWallet();
    await loadTransactions();
  };

  const handleTopUp = async (amount: number) => {
    const keyResponse = await razorpayAPI.getKey();
    const orderResponse = await razorpayAPI.createWalletOrder(amount);

    // Razorpay is no longer in <head>; load the SDK on demand before opening checkout
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load payment SDK'));
        document.head.appendChild(s);
      });
    }

    return new Promise<void>((resolve, reject) => {
      const options = {
        key: keyResponse.key,
        amount: orderResponse.order.amount,
        currency: 'INR',
        name: 'NotesMitra',
        description: 'Wallet Top Up',
        order_id: orderResponse.order.id,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await razorpayAPI.verifyWalletPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            await loadWallet();
            await loadTransactions();
            toast.success(`₹${amount.toFixed(2)} added to your wallet successfully!`);
            resolve();
          } catch (err) {
            toast.error("Payment verification failed. Contact support if amount was deducted.");
            reject(err);
          }
        },
        prefill: {
          name: currentUser?.name || '',
          email: currentUser?.email || '',
          contact: currentUser?.phone || '',
        },
        theme: { color: '#3B82F6' },
        modal: {
          ondismiss: () => reject(new Error('PAYMENT_CANCELLED')), // user closed popup — keep dialog open
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  };

  const handleSavePhone = async (phone: string) => {
    if (!currentUser) return;
    try {
      await authAPI.updateProfile(currentUser.name, currentUser.email, phone);
      setCurrentUser(prev => prev ? { ...prev, phone } : prev);
    } catch {
      // non-critical — silently skip
    }
  };

  const handleAdminWithdraw = async (amount: number, upiId: string) => {
    await walletAPI.withdraw(amount, upiId);
    await loadWallet();
    await loadTransactions();
  };

  const loadPendingWithdrawals = async () => {
    setIsLoadingWithdrawals(true);
    try {
      const data = await walletAPI.getPendingWithdrawals();
      setPendingWithdrawals(data.withdrawals || []);
    } catch {
      // silently fail — tab just shows empty
    } finally {
      setIsLoadingWithdrawals(false);
    }
  };

  const loadAdminUsers = async (search?: string) => {
    setIsLoadingAdminUsers(true);
    setAdminUsersError(null);
    try {
      const data = await adminAPI.getAllUsers(search ? { search } : {});
      setAdminUsers(data.users || []);
      setAdminUsersTotalCount(data.totalCount || 0);
    } catch (err: any) {
      setAdminUsersError(formatClientErrorMessage(err, 'Failed to load users'));
    } finally {
      setIsLoadingAdminUsers(false);
    }
  };

  const handleCompleteWithdrawal = async (walletId: string, txnId: string) => {
    setCompletingTxnId(txnId);
    try {
      await walletAPI.completeWithdrawal(walletId, txnId);
      toast.success("Withdrawal marked as completed!");
      await loadPendingWithdrawals();
    } catch (err: any) {
      toast.error(formatClientErrorMessage(err, "Failed to mark as completed"));
    } finally {
      setCompletingTxnId(null);
    }
  };

  const handleSellerPremiumUpgrade = async () => {
    if (!currentUser) return;

    try {
      const subscribeResponse = await premiumAPI.subscribe('premium_seller', 'monthly');
      const { subscriptionId, price } = subscribeResponse.data;

      setPremiumPaymentData({
        planType: 'seller',
        planName: 'Premium Seller',
        amount: price,
        onSuccess: async (paymentId: string, method: "wallet" | "razorpay") => {
          try {
            await premiumAPI.activateSubscription(subscriptionId, paymentId, method);

            // Refresh user from server to get accurate subscription state
            const profileData = await authAPI.getProfile();
            if (profileData?.user) {
              const refreshedUser = mapUserFromApi(profileData.user);
              setCurrentUser(refreshedUser);
              setUsers(users.map(u => u.email === refreshedUser.email ? refreshedUser : u));
            }
            if (method === 'wallet') await loadWallet();

            toast.success("Premium Seller subscription activated!");
          } catch (error: any) {
            showErrorToast(error, "Failed to activate subscription");
          }
        }
      });
      setShowPremiumPayment(true);
    } catch (error: any) {
      showErrorToast(error, "Failed to initiate subscription");
    }
  };

  const handleBuyerPremiumUpgrade = async () => {
    if (!currentUser) return;
    
    try {
      const subscribeResponse = await premiumAPI.subscribe('premium_buyer', 'monthly');
      const { subscriptionId, price } = subscribeResponse.data;
      
      setPremiumPaymentData({
        planType: 'buyer',
        planName: 'Premium Buyer',
        amount: price,
        onSuccess: async (paymentId: string, method: string) => {
          try {
            await premiumAPI.activateSubscription(subscriptionId, paymentId, method);

            // Refresh user from server to get accurate subscription state
            const profileData = await authAPI.getProfile();
            if (profileData?.user) {
              const refreshedUser = mapUserFromApi(profileData.user);
              setCurrentUser(refreshedUser);
              setUsers(users.map(u => u.email === refreshedUser.email ? refreshedUser : u));
            }
            if (method === 'wallet') await loadWallet();
            
            toast.success("Premium Buyer subscription activated!");
          } catch (error: any) {
            showErrorToast(error, "Failed to activate subscription");
          }
        }
      });
      setShowPremiumPayment(true);
    } catch (error: any) {
      showErrorToast(error, "Failed to initiate subscription");
    }
  };

  const handleComboPremiumUpgrade = async () => {
    if (!currentUser) return;
    
    try {
      // Subscribe to combo plan
      const subscribeResponse = await premiumAPI.subscribe('combo', 'monthly');
      const { subscriptionId, price } = subscribeResponse.data;
      
      // Open payment dialog
      setPremiumPaymentData({
        planType: 'combo',
        planName: 'Combo Pack',
        amount: price,
        onSuccess: async (paymentId: string, method: string) => {
          try {
            await premiumAPI.activateSubscription(subscriptionId, paymentId, method);

            // Refresh user from server to get accurate subscription state
            const profileData = await authAPI.getProfile();
            if (profileData?.user) {
              const refreshedUser = mapUserFromApi(profileData.user);
              setCurrentUser(refreshedUser);
              setUsers(users.map(u => u.email === refreshedUser.email ? refreshedUser : u));
            }
            if (method === 'wallet') await loadWallet();
            
            toast.success("Combo Pack activated! Both Seller & Buyer Premium are now active!");
          } catch (error: any) {
            showErrorToast(error, "Failed to activate subscription");
          }
        }
      });
      setShowPremiumPayment(true);
    } catch (error: any) {
      showErrorToast(error, "Failed to initiate subscription");
    }
  };

  const handleFeatureNote = async (noteId: string, plan: "7days" | "30days") => {
    const expiryDate = new Date();
    if (plan === "7days") {
      expiryDate.setDate(expiryDate.getDate() + 7);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 30);
    }

    setNotes(notes.map(note =>
      note.id === noteId
        ? {
            ...note,
            featured: {
              active: true,
              expiryDate: expiryDate.toISOString(),
              plan,
            },
          }
        : note
    ));

    // Reload real wallet data from server
    await loadWallet();
    await loadTransactions();
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: "pending" | "in-progress" | "resolved") => {
    const mappedStatus = status === "pending" ? "open" : status === "resolved" ? "resolved" : "in_progress";
    await ticketsAPI.updateStatus(ticketId, mappedStatus);
    await loadTickets();
  };

  const handleSubmitTicket = async (ticket: Omit<typeof supportTickets[0], "id" | "date" | "status">) => {
    const category = ticket.issueType.toLowerCase().includes("payment")
      ? "payment"
      : ticket.issueType.toLowerCase().includes("technical")
      ? "technical"
      : ticket.issueType.toLowerCase().includes("content")
      ? "content"
      : "other";

    if (!currentUser) {
      // Guest submission — does not require authentication
      await ticketsAPI.guestCreate(
        ticket.userName || "Guest",
        ticket.userEmail,
        category,
        ticket.issueType,
        ticket.description
      );
      return;
    }

    await ticketsAPI.create(category, ticket.issueType, ticket.description);
    await loadTickets();
  };

  const handleRateNote = async (noteId: string, rating: number, comment?: string) => {
    if (!currentUser) return;

    try {
      const data = await notesAPI.rate(noteId, rating, comment);
      // Update just the rating field in local state — avoids resetting downloads counter
      setNotes(prev => prev.map(note =>
        note.id === noteId ? { ...note, rating: data.rating ?? rating } : note
      ));
      toast.success("Thank you for rating this note!");
    } catch (error: any) {
      showErrorToast(error, "Failed to submit rating");
    }
  };

  const handleNoteDownloaded = (noteId: string, counted = true) => {
    if (!counted) return;
    // Update marketplace notes count (visible on note cards)
    setNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, downloads: (note.downloads || 0) + 1 } : note
    ));
    // Also update seller's own notes so the Dashboard total stays accurate
    setSellerOwnNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, downloads: (note.downloads || 0) + 1 } : note
    ));
  };

  const sellerNotes = sellerOwnNotes; // seller's own notes from dedicated state (all statuses)

  // Derive monthly upload count directly from loaded notes so it's always in sync
  // (avoids the stale profile value shown right after login before notes load)
  const computedMonthlyUploads = (() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return sellerOwnNotes.filter(n => new Date(n.uploadDate) >= monthStart).length;
  })();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Toaster />
      
      {/* Header */}
      <header className="sticky top-0 z-50 transition-all duration-300 bg-white/80 dark:bg-[#0C0B1A]/85 backdrop-blur-xl border-b border-indigo-100/60 dark:border-indigo-900/30 shadow-sm shadow-indigo-100/20 dark:shadow-indigo-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img src={logoImage} alt="NotesMitra Logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-full ring-2 ring-indigo-200/60 dark:ring-indigo-700/40 shadow-md shadow-indigo-200/50 dark:shadow-indigo-900/50" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">NotesMitra</h1>
                <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium tracking-wide">Learn Smarter Together</p>
              </div>
            </div>

            {/* Right side: theme controls + auth buttons + mobile hamburger — all grouped */}
            <div className="flex items-center gap-2">

              {/* Theme & Font Controls */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => changeFontSize(-1)}
                  disabled={fontSize <= 14}
                  title="Decrease font size"
                  className="px-2 py-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-30 text-xs font-bold leading-none"
                >A-</button>
                <button
                  onClick={() => changeFontSize(1)}
                  disabled={fontSize >= 18}
                  title="Increase font size"
                  className="px-2 py-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-30 text-sm font-bold leading-none"
                >A+</button>
                <button
                  onClick={toggleTheme}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
              </div>

              {/* Desktop auth buttons */}
              <div className="hidden md:flex items-center gap-3">
                {activeRole === "admin" ? (
                  isAdminLoggedIn && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setShowChangePassword(true)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Change Password
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleAdminLogout}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    {isLoggedIn ? (
                      <>
                        <span className="text-sm">Hi, {currentUser?.name}</span>
                        <Button variant="outline" size="sm" onClick={() => setShowChangePassword(true)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Change Password
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                          <LogOut className="w-4 h-4 mr-2" />
                          Logout
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setShowAdminLogin(true)}>
                          <Shield className="w-4 h-4 mr-2" />
                          Admin Login
                        </Button>
                        <Button size="sm" onClick={() => setShowAuthDialog(true)}>
                          <LogIn className="w-4 h-4 mr-2" />
                          Login
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 rounded-md hover:bg-accent"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>

            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-indigo-100/50 dark:border-indigo-900/30 py-4 space-y-2 bg-white/95 dark:bg-[#0C0B1A]/95 backdrop-blur-xl">
              {activeRole === "admin" ? (
                isAdminLoggedIn && (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => {
                        setShowChangePassword(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => {
                        handleAdminLogout();
                        setMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                )
              ) : (
                <>
                  {isLoggedIn ? (
                    <>
                      <div className="px-4 py-2 text-sm font-medium">
                        Hi, {currentUser?.name}
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        onClick={() => {
                          setShowChangePassword(true);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Change Password
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start" 
                        onClick={() => {
                          setShowAdminLogin(true);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Admin Login
                      </Button>
                      <Button 
                        className="w-full justify-start" 
                        onClick={() => {
                          setShowAuthDialog(true);
                          setMobileMenuOpen(false);
                        }}
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Login
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10">

        {/* Email verification banner */}
        {isLoggedIn && currentUser && (
          currentUser.isEmailVerified === true
            ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600 px-4 py-2.5 text-sm text-green-800 dark:text-green-300">
                <svg className="w-4 h-4 shrink-0 text-green-500 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                <span><strong>{currentUser.email}</strong> — email verified ✓</span>
              </div>
            )
            : currentUser.isEmailVerified === false ? (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300">
                <span>
                  📧 <strong>Please verify your email</strong> ({currentUser.email}). Check your inbox for a verification link.
                </span>
                <button
                  onClick={async () => {
                    if (resendingVerification) return;
                    setResendingVerification(true);
                    try {
                      await resendFirebaseVerificationEmail();
                      toast.success('Verification email sent! Please check your inbox.');
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to resend. Please log out and log back in, then try again.');
                    } finally {
                      setResendingVerification(false);
                    }
                  }}
                  disabled={resendingVerification}
                  className="shrink-0 rounded bg-yellow-400 dark:bg-yellow-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-500 dark:hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                >
                  {resendingVerification ? 'Sending…' : 'Resend Email'}
                </button>
              </div>
            ) : null
        )}
        {/* Home Screen - Show ONLY when not logged in and not admin */}
        {!isLoggedIn && activeRole !== "admin" && activeRole !== "buyer" && !isAdminLoggedIn && (
          <div className="space-y-12 sm:space-y-16 mb-10 sm:mb-12 md:mb-16">

            {/* ── ALL LANDING ANIMATIONS ── */}
            <style>{`
              @keyframes nmBounce {
                100% { top: -10px; text-shadow: 0 1px 0 #f59e0b,0 2px 0 #f59e0b,0 3px 0 #f59e0b,0 4px 0 #f59e0b,0 5px 0 #f59e0b,0 6px 0 #f59e0b,0 7px 0 #f59e0b,0 8px 0 #f59e0b,0 9px 0 #f59e0b,0 50px 25px rgba(0,0,0,.2); }
              }
              .nm-letter { position:relative; top:20px; display:inline-block; color:#fde68a; animation:nmBounce .3s ease infinite alternate; text-shadow:0 1px 0 #b45309,0 2px 0 #b45309,0 3px 0 #b45309,0 4px 0 #b45309,0 5px 0 #b45309,0 6px 0 transparent,0 7px 0 transparent,0 8px 0 transparent,0 9px 0 transparent,0 10px 10px rgba(0,0,0,.4); }

              @keyframes fadeInUp { from{transform:translateY(20px)} to{transform:translateY(0)} }
              .lf { animation: fadeInUp 0.6s ease forwards; }
              .lf1{animation-delay:.1s} .lf2{animation-delay:.25s} .lf3{animation-delay:.4s}
              .lf4{animation-delay:.55s} .lf5{animation-delay:.7s} .lf6{animation-delay:.85s}

              @keyframes floatUD { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
              .flt1{animation:floatUD 4s ease-in-out infinite}
              .flt2{animation:floatUD 5s ease-in-out infinite;animation-delay:1s}
              .flt3{animation:floatUD 6s ease-in-out infinite;animation-delay:2s}

              @keyframes spinSlow{to{transform:rotate(360deg)}}
              .sspin{animation:spinSlow 22s linear infinite}
              .srev{animation:spinSlow 16s linear infinite reverse}

              @keyframes particleDrift {
                0%{transform:translateY(0) translateX(0) scale(1);opacity:.6}
                50%{opacity:1}
                100%{transform:translateY(-90px) translateX(18px) scale(.4);opacity:0}
              }
              .ptcl{position:absolute;border-radius:50%;background:rgba(255,255,255,.35);animation:particleDrift linear infinite}

              @keyframes shimmerSlide{0%{left:-100%}100%{left:200%}}
              .btn-shim{position:relative;overflow:hidden}
              .btn-shim::after{content:'';position:absolute;top:0;left:-100%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);animation:shimmerSlide 2.8s linear infinite}

              @keyframes marqueeScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
              .pill-track{display:flex;animation:marqueeScroll 24s linear infinite;width:max-content}
              .pill-track:hover{animation-play-state:paused}
              .testi-track{display:flex;gap:18px;animation:marqueeScroll 32s linear infinite;width:max-content}
              .testi-track:hover{animation-play-state:paused}

              @keyframes badgePing{0%{transform:scale(1);opacity:1}75%,100%{transform:scale(2.2);opacity:0}}
              .bping{animation:badgePing 1.6s cubic-bezier(0,0,.2,1) infinite}

              @keyframes numReveal{from{opacity:0;transform:scale(.7)}60%{transform:scale(1.1)}to{opacity:1;transform:scale(1)}}
              .nrev{animation:numReveal .8s ease both}

              @keyframes ctaGlow{0%,100%{box-shadow:0 0 30px 0 rgba(139,92,246,.4)}50%{box-shadow:0 0 60px 12px rgba(139,92,246,.6)}}
              .cta-glow{animation:ctaGlow 3.5s ease-in-out infinite}

              .step-card{transition:transform .3s ease,box-shadow .3s ease}
              .step-card:hover{transform:translateY(-10px)}
              .feat-card{transition:transform .25s ease,box-shadow .25s ease}
              .feat-card:hover{transform:translateY(-5px)}
            `}</style>

            {/* ── Feature Pills Ticker ── */}
            <div className="overflow-hidden py-1">
              <div className="pill-track gap-3">
                {[
                  '📚 10K+ Students','💸 Earn 80% Commission','⚡ Instant Download',
                  '🔒 Secure Payments','⭐ Verified Notes','🎓 All Subjects',
                  '📱 Mobile Friendly','🚀 Fast Upload','💬 24/7 Support','🇮🇳 Made in India',
                  '📚 10K+ Students','💸 Earn 80% Commission','⚡ Instant Download',
                  '🔒 Secure Payments','⭐ Verified Notes','🎓 All Subjects',
                  '📱 Mobile Friendly','🚀 Fast Upload','💬 24/7 Support','🇮🇳 Made in India',
                ].map((pill, i) => (
                  <span key={i} className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 whitespace-nowrap select-none cursor-default">
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Hero ── */}
            <div className="relative overflow-hidden rounded-3xl min-h-[480px] flex items-center">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e1b4b] via-[#4f46e5] to-[#7c3aed]" />
              <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
                <defs><pattern id="hdots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></pattern></defs>
                <rect width="100%" height="100%" fill="url(#hdots)"/>
              </svg>
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-300/15 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1.5s'}} />
              <svg className="absolute top-4 right-8 w-24 h-24 opacity-20 text-white sspin" viewBox="0 0 96 96" fill="none"><circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 5"/></svg>
              <svg className="absolute bottom-6 left-6 w-16 h-16 opacity-15 text-white srev" viewBox="0 0 64 64" fill="none"><rect x="3" y="3" width="58" height="58" rx="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 3"/></svg>
              {/* Floating particles */}
              {([
                {w:6,h:6,left:'14%',top:'18%',dur:'5s',delay:'0s'},
                {w:4,h:4,left:'32%',top:'72%',dur:'7s',delay:'1s'},
                {w:8,h:8,left:'62%',top:'14%',dur:'6s',delay:'2s'},
                {w:5,h:5,left:'77%',top:'63%',dur:'8s',delay:'.5s'},
                {w:3,h:3,left:'87%',top:'33%',dur:'5.5s',delay:'1.5s'},
              ] as any[]).map((p:any,i:number) => (
                <div key={i} className="ptcl" style={{width:p.w,height:p.h,left:p.left,top:p.top,animationDuration:p.dur,animationDelay:p.delay}} />
              ))}
              {/* Deco stars */}
              <svg className="absolute top-10 left-[21%] w-5 h-5 opacity-40 text-amber-300 flt1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.09 8.26L19 6L15.45 11.09L22 12L15.45 12.91L19 18L13.09 15.74L12 22L10.91 15.74L5 18L8.55 12.91L2 12L8.55 11.09L5 6L10.91 8.26L12 2Z"/></svg>
              <svg className="absolute bottom-10 right-[21%] w-4 h-4 opacity-30 text-indigo-200 flt2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L13.09 8.26L19 6L15.45 11.09L22 12L15.45 12.91L19 18L13.09 15.74L12 22L10.91 15.74L5 18L8.55 12.91L2 12L8.55 11.09L5 6L10.91 8.26L12 2Z"/></svg>
              <svg className="absolute top-1/2 left-[7%] w-6 h-6 opacity-20 text-violet-200 flt3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>

              <div className="relative w-full px-6 sm:px-10 md:px-16 lg:px-24 py-16 sm:py-20 text-center space-y-6">
                {/* Live badge */}
                <div className="lf lf1 inline-flex items-center gap-2.5 bg-white/12 backdrop-blur-md border border-white/20 px-4 py-2 rounded-full text-xs sm:text-sm text-white/90 font-medium shadow-lg">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="bping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-300" />
                  </span>
                  India's #1 Academic Notes Marketplace
                </div>

                {/* Heading with bouncing NotesMitra */}
                <h2 className="lf lf2 text-3xl sm:text-4xl md:text-5xl lg:text-[3.75rem] font-extrabold text-white tracking-tight leading-tight">
                  Welcome to&nbsp;
                  <span className="relative inline-block">
                    {'NotesMitra'.split('').map((ch, i) => (
                      <span key={i} className="nm-letter" style={{animationDelay:`${i*0.1}s`}}>{ch}</span>
                    ))}
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400/0 via-amber-400/70 to-amber-400/0 rounded-full blur-sm" />
                  </span>
                </h2>

                <p className="lf lf3 text-lg sm:text-xl md:text-2xl text-white/85 max-w-2xl mx-auto font-medium">
                  Buy and Sell Quality Academic Notes
                </p>
                <p className="lf lf3 text-sm sm:text-base text-white/60">Trusted by Thousands of Students Across India 🇮🇳</p>

                {/* Animated stats */}
                <div className="lf lf4 flex flex-wrap justify-center items-center gap-1 pt-2">
                  {[
                    {icon:'📈', num:'10K+', label:'Active Users'},
                    {icon:'📄', num:'5K+',  label:'Quality Notes'},
                    {icon:'🏆', num:'98%',  label:'Satisfaction'},
                  ].map((s, i) => (
                    <div key={s.label} className="text-center px-7 sm:px-10">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xl">{s.icon}</span>
                        <span className="nrev text-2xl sm:text-3xl md:text-4xl font-extrabold text-white" style={{animationDelay:`${.5+i*.2}s`}}>{s.num}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-white/55 uppercase tracking-widest font-semibold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* CTAs */}
                <div className="lf lf5 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-4">
                  <Button size="lg" className="btn-shim bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-xl shadow-indigo-900/30 hover:shadow-2xl transition-all duration-300 hover:scale-105 text-sm sm:text-base px-8 rounded-xl" onClick={() => setShowAuthDialog(true)}>
                    <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Get Started — Free
                  </Button>
                  <Button size="lg" className="bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 text-sm sm:text-base px-8 rounded-xl" onClick={() => setActiveRole('buyer')}>
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Browse Marketplace
                  </Button>
                </div>
              </div>
            </div>

            {/* ── How It Works ── */}
            <div className="space-y-8">
              <div className="text-center space-y-2 lf lf1">
                <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/40 px-4 py-1.5 rounded-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">✨ Simple Process</div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent">How NotesMitra Works</h3>
                <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">Simple, Secure, and Student-Friendly</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-5 sm:gap-6 relative">
                {/* Connecting line on desktop */}
                <div className="hidden sm:block absolute top-[52px] left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-0.5 bg-gradient-to-r from-indigo-200 via-violet-300 to-emerald-200 dark:from-indigo-800/60 dark:via-violet-800/60 dark:to-emerald-800/60 z-0" />
                {[
                  {step:1, icon:UserCircle, title:'Create Account',    desc:'Sign up free in seconds — choose seller or buyer role',                          color:'indigo', delay:'.1s',  badge:'⚡ Quick'},
                  {step:2, icon:FileText,   title:'Upload or Browse',  desc:'Sellers upload notes; buyers browse and preview quality content',                color:'violet', delay:'.25s', badge:'📚 Easy'},
                  {step:3, icon:Award,      title:'Earn & Learn',      desc:'Sellers get paid 80%; buyers download instantly and ace their exams',            color:'emerald',delay:'.4s',  badge:'💰 Rewarding'},
                ].map(({step, icon:Icon, title, desc, color, delay, badge}) => (
                  <div key={step} className={`step-card lf relative bg-white dark:bg-card rounded-2xl p-6 sm:p-8 border shadow-sm overflow-hidden z-10
                    ${color==='indigo'  ? 'border-indigo-100/80 dark:border-indigo-900/40 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/30' : ''}
                    ${color==='violet'  ? 'border-violet-100/80 dark:border-violet-900/40 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100/50 dark:hover:shadow-violet-900/30' : ''}
                    ${color==='emerald' ? 'border-emerald-100/80 dark:border-emerald-900/40 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-100/50 dark:hover:shadow-emerald-900/30' : ''}
                  `} style={{animationDelay:delay}}>
                    <div className={`absolute -bottom-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-25
                      ${color==='indigo' ? 'bg-indigo-300 dark:bg-indigo-700' : ''}
                      ${color==='violet' ? 'bg-violet-300 dark:bg-violet-700' : ''}
                      ${color==='emerald'? 'bg-emerald-300 dark:bg-emerald-700' : ''}
                    `} />
                    <div className={`absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                      ${color==='indigo' ? 'bg-indigo-500':''}${color==='violet' ? 'bg-violet-500':''}${color==='emerald'? 'bg-emerald-500':''}
                    `}>{step}</div>
                    <div className="relative space-y-4 text-center">
                      <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center shadow-lg
                        ${color==='indigo'  ? 'bg-gradient-to-br from-indigo-500 to-indigo-700  shadow-indigo-200/50 dark:shadow-indigo-900/60' : ''}
                        ${color==='violet'  ? 'bg-gradient-to-br from-violet-500 to-purple-700  shadow-violet-200/50 dark:shadow-violet-900/60' : ''}
                        ${color==='emerald' ? 'bg-gradient-to-br from-emerald-500 to-teal-600   shadow-emerald-200/50 dark:shadow-emerald-900/60' : ''}
                      `}><Icon className="w-7 h-7 text-white" /></div>
                      <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full
                        ${color==='indigo'  ? 'text-indigo-600  dark:text-indigo-400  bg-indigo-50  dark:bg-indigo-950/60'  : ''}
                        ${color==='violet'  ? 'text-violet-600  dark:text-violet-400  bg-violet-50  dark:bg-violet-950/60'  : ''}
                        ${color==='emerald' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60' : ''}
                      `}>{badge}</span>
                      <h4 className="text-lg font-bold text-foreground">{title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Why Choose Us ── */}
            <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-card border border-indigo-100/80 dark:border-indigo-900/40 shadow-sm lf lf2">
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-gradient-to-bl from-indigo-200/40 dark:from-indigo-800/20 to-transparent rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-gradient-to-tr from-violet-200/30 dark:from-violet-800/20 to-transparent rounded-full blur-3xl pointer-events-none" />
              <div className="relative p-7 sm:p-10 md:p-14">
                <div className="text-center space-y-2 mb-8 sm:mb-10">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Why Students Love NotesMitra 💙</h3>
                  <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">The most trusted platform for academic excellence</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto">
                  {[
                    {icon:Zap,    label:'Instant Access',       desc:'Download notes immediately after purchase, available 24/7',                 color:'indigo', emoji:'⚡'},
                    {icon:Shield, label:'Secure Payments',      desc:'Safe and encrypted transactions with multiple payment options',              color:'violet', emoji:'🔒'},
                    {icon:Star,   label:'Top Rated Notes',      desc:'Browse reviews and ratings from verified buyers',                           color:'amber',  emoji:'⭐'},
                    {icon:Award,  label:'Earn While You Learn', desc:"Sellers earn 80% commission on every sale — no hidden fees",               color:'emerald', emoji:'💰'},
                  ].map(({icon:Icon, label, desc, color, emoji}, i) => (
                    <div key={label} className={`feat-card lf flex gap-4 p-4 sm:p-5 rounded-xl border cursor-default select-none
                      ${color==='indigo'  ? 'bg-indigo-50/70  dark:bg-indigo-950/40  border-indigo-100  dark:border-indigo-900/50  hover:border-indigo-300  hover:shadow-lg hover:shadow-indigo-100/60'  : ''}
                      ${color==='violet'  ? 'bg-violet-50/70  dark:bg-violet-950/40  border-violet-100  dark:border-violet-900/50  hover:border-violet-300  hover:shadow-lg hover:shadow-violet-100/60'  : ''}
                      ${color==='amber'   ? 'bg-amber-50/70   dark:bg-amber-950/30   border-amber-100   dark:border-amber-900/50   hover:border-amber-300   hover:shadow-lg hover:shadow-amber-100/50'   : ''}
                      ${color==='emerald' ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100/50' : ''}
                    `} style={{animationDelay:`${.1+i*.15}s`}}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm text-white
                        ${color==='indigo'  ? 'bg-gradient-to-br from-indigo-500  to-indigo-700'  : ''}
                        ${color==='violet'  ? 'bg-gradient-to-br from-violet-500  to-purple-700'  : ''}
                        ${color==='amber'   ? 'bg-gradient-to-br from-amber-400   to-orange-500'  : ''}
                        ${color==='emerald' ? 'bg-gradient-to-br from-emerald-500 to-teal-600'    : ''}
                      `}><Icon className="w-5 h-5" /></div>
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-foreground mb-0.5">{emoji} {label}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Testimonials Marquee ── */}
            <div className="overflow-hidden space-y-5">
              <div className="text-center lf lf1">
                <h3 className="text-xl sm:text-2xl font-extrabold text-foreground">What Students Say 💬</h3>
                <p className="text-sm text-muted-foreground mt-1">Real reviews from verified students</p>
              </div>
              <div className="overflow-hidden">
                <div className="testi-track">
                  {[
                    {name:'Priya S.',  college:'Delhi University',   text:'NotesMitra saved my semester! Found perfect notes for all my subjects in minutes.',         rating:5},
                    {name:'Rohit K.',  college:'IIT Bombay',         text:'Earned ₹8,000 last month uploading old notes. Best passive income for students ever!',      rating:5},
                    {name:'Sneha M.',  college:'Pune University',     text:'The quality of notes here is genuinely excellent. Worth every rupee spent.',               rating:5},
                    {name:'Arjun T.',  college:'VIT Vellore',        text:'Super easy to buy and instant download. Never going back to photocopies again!',            rating:5},
                    {name:'Kavya R.',  college:'BITS Pilani',        text:'80% payout to sellers is incredible. The most honest marketplace for students.',            rating:5},
                    {name:'Amit P.',   college:'Jadavpur University', text:'Admin review ensures only quality notes are listed. Very trustworthy platform!',           rating:5},
                    {name:'Priya S.',  college:'Delhi University',   text:'NotesMitra saved my semester! Found perfect notes for all my subjects in minutes.',         rating:5},
                    {name:'Rohit K.',  college:'IIT Bombay',         text:'Earned ₹8,000 last month uploading old notes. Best passive income for students ever!',      rating:5},
                    {name:'Sneha M.',  college:'Pune University',     text:'The quality of notes here is genuinely excellent. Worth every rupee spent.',               rating:5},
                    {name:'Arjun T.',  college:'VIT Vellore',        text:'Super easy to buy and instant download. Never going back to photocopies again!',            rating:5},
                    {name:'Kavya R.',  college:'BITS Pilani',        text:'80% payout to sellers is incredible. The most honest marketplace for students.',            rating:5},
                    {name:'Amit P.',   college:'Jadavpur University', text:'Admin review ensures only quality notes are listed. Very trustworthy platform!',           rating:5},
                  ].map((t, i) => (
                    <div key={i} className="flex-shrink-0 w-72 bg-white dark:bg-card border border-indigo-100/70 dark:border-indigo-900/40 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200">
                      <div className="flex items-center gap-0.5 mb-3">
                        {Array.from({length:t.rating}).map((_,s) => <span key={s} className="text-amber-400 text-sm">★</span>)}
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed mb-3">"{t.text}"</p>
                      <div>
                        <p className="text-sm font-bold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.college}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Bottom CTA Banner ── */}
            <div className="relative overflow-hidden rounded-3xl cta-glow">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700" />
              <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
                <defs><pattern id="ctadots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></pattern></defs>
                <rect width="100%" height="100%" fill="url(#ctadots)"/>
              </svg>
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
              <div className="relative text-center px-6 sm:px-10 py-12 sm:py-16 space-y-5">
                <div className="inline-block bg-white/15 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-xs font-bold text-white/90 uppercase tracking-widest">🚀 Join Free Today</div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">Start Your Academic Journey</h3>
                <p className="text-white/70 text-sm sm:text-base max-w-md mx-auto">Join 10,000+ students already learning smarter and earning more with NotesMitra</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <Button size="lg" className="btn-shim bg-white text-indigo-700 hover:bg-indigo-50 font-bold shadow-xl transition-all duration-300 hover:scale-105 px-8 rounded-xl" onClick={() => setShowAuthDialog(true)}>
                    <LogIn className="w-5 h-5 mr-2" />Create Free Account
                  </Button>
                  <Button size="lg" className="bg-white/15 hover:bg-white/25 text-white border border-white/40 backdrop-blur-sm font-semibold transition-all duration-300 hover:scale-105 px-8 rounded-xl shadow-lg" onClick={() => setActiveRole('buyer')}>
                    <ShoppingBag className="w-5 h-5 mr-2" />Explore Notes
                  </Button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Role Switcher - Only show after login for seller/buyer (NOT for admin accounts) */}
        {activeRole !== "admin" && isLoggedIn && currentUser?.role !== 'admin' && (
          <div className="mb-6 relative overflow-hidden rounded-2xl border border-indigo-100/70 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/80 via-violet-50/60 to-purple-50/80 dark:from-indigo-950/50 dark:via-violet-950/40 dark:to-purple-950/50 p-4 sm:p-5 shadow-sm">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-indigo-200/30 dark:bg-indigo-700/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Switch Mode</p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => setActiveRole("seller")}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 text-sm ${
                  activeRole === "seller"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-300/40 dark:shadow-indigo-900/50 scale-[1.02]"
                    : "bg-white dark:bg-card border border-indigo-100 dark:border-indigo-900/50 text-foreground hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-md hover:shadow-indigo-100/40 dark:hover:shadow-indigo-900/30"
                }`}
              >
                <UserCircle className="w-4 h-4" />
                Seller Dashboard
              </button>
              <button
                onClick={() => setActiveRole("buyer")}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 text-sm ${
                  activeRole === "buyer"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-300/40 dark:shadow-indigo-900/50 scale-[1.02]"
                    : "bg-white dark:bg-card border border-indigo-100 dark:border-indigo-900/50 text-foreground hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:shadow-md hover:shadow-indigo-100/40 dark:hover:shadow-indigo-900/30"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Buyer Marketplace
              </button>
            </div>
          </div>
        )}

        {/* Content based on login state and role */}
        {activeRole === "admin" && !isAdminLoggedIn ? (
          <div className="relative overflow-hidden rounded-2xl border border-violet-100/80 dark:border-violet-900/40 bg-white dark:bg-card shadow-sm p-10 sm:p-14 md:p-20 text-center">
            <div className="absolute inset-0 opacity-5 dark:opacity-[0.04]">
              <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="admin-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" fill="#4F46E5"/></pattern></defs><rect width="100%" height="100%" fill="url(#admin-dots)"/></svg>
            </div>
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-violet-200/50 dark:shadow-violet-900/50">
                <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 tracking-tight">Admin Panel</h2>
              <p className="text-sm sm:text-base text-muted-foreground mb-7 max-w-xs mx-auto">
                Please login to access the admin panel
              </p>
              <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white shadow-lg shadow-violet-300/40 dark:shadow-violet-900/50 px-8 rounded-xl font-bold" onClick={() => setShowAdminLogin(true)}>
                <Shield className="w-4 h-4 mr-2" />
                Admin Login
              </Button>
            </div>
          </div>
        ) : (
          <>
            {activeRole === "seller" && isLoggedIn && currentUser?.role !== 'admin' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Total Sales", value: isLoadingSellerStats ? "..." : sellerStats.totalSales, icon: TrendingUp, color: "indigo" },
                    { label: "Total Earnings", value: isLoadingSellerStats ? "..." : `₹${sellerStats.totalEarnings.toFixed(2)}`, icon: Award, color: "violet" },
                    { label: "Total Downloads", value: isLoadingSellerStats ? "..." : sellerStats.totalDownloads, icon: FileText, color: "emerald" },
                    { label: "Notes (Approved/Pending)", value: isLoadingSellerStats ? "..." : `${sellerStats.approvedNotes}/${sellerStats.pendingNotes}`, icon: Shield, color: "amber" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`relative bg-white dark:bg-card rounded-2xl p-5 border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 overflow-hidden
                      ${color === 'indigo' ? 'border-indigo-100/80 dark:border-indigo-900/40 hover:border-indigo-200 dark:hover:border-indigo-800/60' : ''}
                      ${color === 'violet' ? 'border-violet-100/80 dark:border-violet-900/40 hover:border-violet-200 dark:hover:border-violet-800/60' : ''}
                      ${color === 'emerald' ? 'border-emerald-100/80 dark:border-emerald-900/40 hover:border-emerald-200 dark:hover:border-emerald-800/60' : ''}
                      ${color === 'amber' ? 'border-amber-100/80 dark:border-amber-900/40 hover:border-amber-200 dark:hover:border-amber-800/60' : ''}
                    `}>
                      <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-3xl opacity-40
                        ${color === 'indigo' ? 'bg-gradient-to-bl from-indigo-100 dark:from-indigo-900/50 to-transparent' : ''}
                        ${color === 'violet' ? 'bg-gradient-to-bl from-violet-100 dark:from-violet-900/50 to-transparent' : ''}
                        ${color === 'emerald' ? 'bg-gradient-to-bl from-emerald-100 dark:from-emerald-900/50 to-transparent' : ''}
                        ${color === 'amber' ? 'bg-gradient-to-bl from-amber-100 dark:from-amber-900/50 to-transparent' : ''}
                      `} />
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm
                          ${color === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : ''}
                          ${color === 'violet' ? 'bg-gradient-to-br from-violet-500 to-purple-700' : ''}
                          ${color === 'emerald' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}
                          ${color === 'amber' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : ''}
                        `}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
                          <p className={`text-2xl font-extrabold tracking-tight mt-0.5
                            ${color === 'indigo' ? 'text-indigo-700 dark:text-indigo-400' : ''}
                            ${color === 'violet' ? 'text-violet-700 dark:text-violet-400' : ''}
                            ${color === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : ''}
                            ${color === 'amber' ? 'text-amber-700 dark:text-amber-400' : ''}
                          `}>{value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {analyticsError && (
                  <Card>
                    <CardContent className="py-4 text-center text-red-600">
                      {formatClientErrorMessage(analyticsError)}
                    </CardContent>
                  </Card>
                )}

                <Tabs defaultValue="upload" className="space-y-6">
                  <div className="overflow-x-auto pb-1">
                  <TabsList className="w-max min-w-full">
                    <TabsTrigger value="upload">Upload Notes</TabsTrigger>
                    <TabsTrigger value="wallet">Wallet</TabsTrigger>
                    <TabsTrigger value="premium">Premium Plans</TabsTrigger>
                  </TabsList>
                  </div>

                <TabsContent value="upload">
                  <SellerDashboard
                    notes={sellerNotes}
                    onUploadNote={handleUploadNote}
                    isLoading={isLoadingNotes}
                    errorMessage={notesError}
                    sellerPremium={currentUser?.sellerPremium}
                    monthlyUploads={computedMonthlyUploads}
                    onUpgradePremium={() => {
                      const premiumTab = document.querySelector('[data-value="premium"]') as HTMLElement;
                      premiumTab?.click();
                    }}
                  />
                </TabsContent>

                <TabsContent value="wallet">
                  <Wallet
                    balance={walletBalance}
                    transactions={transactions}
                    onWithdraw={handleWithdraw}
                    onTopUp={handleTopUp}
                    onRefresh={loadTransactions}
                    isLoading={isLoadingWallet}
                    errorMessage={walletError}
                    totalEarningsOverride={sellerStats.totalEarnings}
                    availableBalanceOverride={walletWithdrawableBalance ?? walletBalance}
                  />
                </TabsContent>

                <TabsContent value="premium">
                  <SellerPremiumPlans
                    isPremium={currentUser?.sellerPremium?.active || false}
                    expiryDate={currentUser?.sellerPremium?.expiryDate}
                    onUpgrade={handleSellerPremiumUpgrade}
                    onComboUpgrade={handleComboPremiumUpgrade}
                    walletBalance={walletBalance}
                    onFeatureNote={handleFeatureNote}
                    hasComboActive={currentUser?.sellerPremium?.active && currentUser?.buyerPremium?.active}
                  />
                </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Buyer View - Only show when logged in */}
            {activeRole === "buyer" && isLoggedIn && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Total Purchases", value: isLoadingBuyerStats ? "..." : buyerStats.totalPurchases, icon: ShoppingBag, color: "indigo" },
                    { label: "Total Spent", value: isLoadingBuyerStats ? "..." : `₹${buyerStats.totalSpent.toFixed(2)}`, icon: TrendingUp, color: "violet" },
                    { label: "Downloads", value: isLoadingBuyerStats ? "..." : purchasedNotes.length, icon: FileText, color: "emerald" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`relative bg-white dark:bg-card rounded-2xl p-5 border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 overflow-hidden
                      ${color === 'indigo' ? 'border-indigo-100/80 dark:border-indigo-900/40 hover:border-indigo-200 dark:hover:border-indigo-800/60' : ''}
                      ${color === 'violet' ? 'border-violet-100/80 dark:border-violet-900/40 hover:border-violet-200 dark:hover:border-violet-800/60' : ''}
                      ${color === 'emerald' ? 'border-emerald-100/80 dark:border-emerald-900/40 hover:border-emerald-200 dark:hover:border-emerald-800/60' : ''}
                    `}>
                      <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-3xl opacity-40
                        ${color === 'indigo' ? 'bg-gradient-to-bl from-indigo-100 dark:from-indigo-900/50 to-transparent' : ''}
                        ${color === 'violet' ? 'bg-gradient-to-bl from-violet-100 dark:from-violet-900/50 to-transparent' : ''}
                        ${color === 'emerald' ? 'bg-gradient-to-bl from-emerald-100 dark:from-emerald-900/50 to-transparent' : ''}
                      `} />
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm
                          ${color === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : ''}
                          ${color === 'violet' ? 'bg-gradient-to-br from-violet-500 to-purple-700' : ''}
                          ${color === 'emerald' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}
                        `}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
                          <p className={`text-2xl font-extrabold tracking-tight mt-0.5
                            ${color === 'indigo' ? 'text-indigo-700 dark:text-indigo-400' : ''}
                            ${color === 'violet' ? 'text-violet-700 dark:text-violet-400' : ''}
                            ${color === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : ''}
                          `}>{value}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {analyticsError && (
                  <Card>
                    <CardContent className="py-4 text-center text-red-600">
                      {formatClientErrorMessage(analyticsError)}
                    </CardContent>
                  </Card>
                )}

                <Tabs defaultValue="marketplace" className="space-y-6">
                  <div className="overflow-x-auto pb-1">
                  <TabsList className="w-max min-w-full">
                    <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
                    <TabsTrigger value="downloads">Downloads</TabsTrigger>
                    <TabsTrigger value="premium">Premium Plans</TabsTrigger>
                  </TabsList>
                  </div>

                <TabsContent value="marketplace">
                  <BuyerMarketplace
                    notes={notes}
                    purchasedNotes={purchasedNotes}
                    onPurchase={handlePurchase}
                    isLoggedIn={isLoggedIn}
                    onLoginRequired={() => setShowAuthDialog(true)}
                    buyerPremium={currentUser?.buyerPremium}
                    onUpgradePremium={handleBuyerPremiumUpgrade}
                    onRateNote={handleRateNote}
                    currentUserId={currentUser?.email}
                    walletBalance={walletBalance}
                    userName={currentUser?.name}
                    userEmail={currentUser?.email}
                    userPhone={currentUser?.phone}
                    onSavePhone={handleSavePhone}
                    isLoading={isLoadingNotes}
                    errorMessage={notesError}
                    onDownloadSuccess={(noteId, counted) => handleNoteDownloaded(noteId, counted)}
                  />
                </TabsContent>

                <TabsContent value="downloads">
                  <Downloads
                    notes={notes}
                    purchasedNotes={purchasedNotes}
                    isLoading={isLoadingNotes}
                    errorMessage={notesError}
                    onDownload={async (note) => {
                      try {
                        const result = await notesAPI.download(note.id);
                        handleNoteDownloaded(note.id, result.counted);
                        toast.success(`✓ Download successful! ${note.title} saved.`);
                      } catch (error: any) {
                        showErrorToast(error, "Download failed");
                      }
                    }}
                  />
                </TabsContent>

                <TabsContent value="premium">
                  <BuyerPremiumPlans
                    isPremium={currentUser?.buyerPremium?.active || false}
                    expiryDate={currentUser?.buyerPremium?.expiryDate}
                    onUpgrade={handleBuyerPremiumUpgrade}
                    onComboUpgrade={handleComboPremiumUpgrade}
                    hasComboActive={currentUser?.sellerPremium?.active && currentUser?.buyerPremium?.active}
                  />
                </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Buyer View - Browse Marketplace when not logged in */}
            {activeRole === "buyer" && !isLoggedIn && (
              <div className="space-y-6">
                {/* Back to Home Button */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setActiveRole(null)}
                    className="hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                  </Button>
                  <div className="h-px flex-1 bg-indigo-100/60 dark:bg-indigo-900/40"></div>
                </div>

                <Card className="relative overflow-hidden border-0 shadow-lg">
                  {/* Gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700" />
                  {/* Dot pattern overlay */}
                  <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
                    <defs><pattern id="mp-dots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" fill="white"/></pattern></defs>
                    <rect width="100%" height="100%" fill="url(#mp-dots)"/>
                  </svg>
                  {/* Glow orbs */}
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-violet-400/25 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />
                  <CardContent className="relative pt-10 pb-8 px-6 text-center space-y-4">
                    <div className="relative inline-flex items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-xl">
                        <ShoppingBag className="w-8 h-8 text-white" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-300 items-center justify-center text-[8px] font-bold text-amber-900">✦</span>
                      </span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-white tracking-tight">Browse Our Marketplace</h3>
                      <p className="text-white/70 text-sm mt-1">Preview quality notes — login to purchase and download instantly</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      {['📚 All Subjects','⚡ Instant Access','🔒 Secure','⭐ Verified'].map(pill => (
                        <span key={pill} className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 border border-white/20 text-white/90">{pill}</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <BuyerMarketplace
                  notes={notes}
                  purchasedNotes={[]}
                  onPurchase={handlePurchase}
                  isLoggedIn={false}
                  onLoginRequired={() => setShowAuthDialog(true)}
                  buyerPremium={false}
                  onUpgradePremium={handleBuyerPremiumUpgrade}
                  walletBalance={0}
                  isLoading={isLoadingNotes}
                  errorMessage={notesError}
                />
              </div>
            )}

            {/* Admin View */}
            {activeRole === "admin" && isAdminLoggedIn && (
              <Tabs defaultValue="review" className="space-y-6">
                <div className="overflow-x-auto pb-1">
                <TabsList className="w-max min-w-full">
                  <TabsTrigger value="review">Pending Notes</TabsTrigger>
                  <TabsTrigger value="queries">Support Queries</TabsTrigger>
                  <TabsTrigger value="withdrawals" onClick={loadPendingWithdrawals}>Withdrawals</TabsTrigger>
                  <TabsTrigger value="wallet">Platform Wallet</TabsTrigger>
                  <TabsTrigger value="users" onClick={() => loadAdminUsers()}>Users</TabsTrigger>
                  <TabsTrigger value="stats">Admin Stats</TabsTrigger>
                </TabsList>
                </div>

                <TabsContent value="review">
                  <AdminReview
                    notes={notes}
                    onApprove={handleApproveNote}
                    onReject={handleRejectNote}
                    isLoading={isLoadingNotes}
                    errorMessage={notesError}
                  />
                </TabsContent>

                <TabsContent value="queries">
                  <AdminQueries 
                    tickets={supportTickets}
                    onUpdateStatus={handleUpdateTicketStatus}
                    isLoading={isLoadingTickets}
                    errorMessage={ticketsError}
                  />
                </TabsContent>

                <TabsContent value="withdrawals">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Pending Seller Withdrawals</h3>
                      <Button variant="outline" size="sm" onClick={loadPendingWithdrawals} disabled={isLoadingWithdrawals}>
                        {isLoadingWithdrawals ? "Loading..." : "Refresh"}
                      </Button>
                    </div>
                    {isLoadingWithdrawals ? (
                      <p className="text-center py-8 text-muted-foreground">Loading withdrawals...</p>
                    ) : pendingWithdrawals.length === 0 ? (
                      <Card><CardContent className="py-10 text-center text-muted-foreground">No pending withdrawals</CardContent></Card>
                    ) : (
                      <div className="space-y-3">
                        {pendingWithdrawals.map((w) => (
                          <Card key={w.txnId}>
                            <CardContent className="pt-4 pb-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-medium">{w.sellerName} <span className="text-xs text-muted-foreground">({w.sellerEmail})</span></p>
                                  <p className="text-sm">UPI: <span className="font-mono font-semibold text-blue-700">{w.upiId}</span></p>
                                  <p className="text-xs text-muted-foreground">Requested: {new Date(w.requestedAt).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl font-bold text-green-700">₹{w.amount.toFixed(2)}</span>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    disabled={completingTxnId === w.txnId}
                                    onClick={() => handleCompleteWithdrawal(w.walletId, w.txnId)}
                                  >
                                    {completingTxnId === w.txnId ? "Saving..." : "✓ Mark Paid"}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
                      <p className="font-semibold mb-1">How to pay sellers:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-800">
                        <li>Open any UPI app (GPay, PhonePe, Paytm, etc.)</li>
                        <li>Send ₹<strong>exact amount</strong> to the seller's UPI ID shown above</li>
                        <li>Click <strong>"Mark Paid"</strong> to confirm and close the request</li>
                      </ol>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="wallet">
                  <Wallet
                    balance={adminWalletBalance}
                    transactions={adminTransactions}
                    onWithdraw={handleAdminWithdraw}
                    onRefresh={loadAdminStats}
                    isAdmin={true}
                    isLoading={isLoadingAdminStats}
                    errorMessage={adminStatsError}
                    totalEarningsOverride={Number(adminStats?.platformTotalEarnings ?? adminStats?.totalPlatformEarnings ?? adminStats?.totalRevenue ?? 0)}
                  />
                </TabsContent>

                <TabsContent value="users">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold">All Users {adminUsersTotalCount > 0 && <span className="text-base font-normal text-muted-foreground">({adminUsersTotalCount})</span>}</h3>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search by name or email..."
                          value={adminUsersSearch}
                          onChange={e => setAdminUsersSearch(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && loadAdminUsers(adminUsersSearch)}
                          className="border rounded px-3 py-1.5 text-sm w-64 bg-background"
                        />
                        <Button size="sm" onClick={() => loadAdminUsers(adminUsersSearch)} disabled={isLoadingAdminUsers}>
                          {isLoadingAdminUsers ? 'Loading...' : 'Search'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setAdminUsersSearch(''); loadAdminUsers(); }} disabled={isLoadingAdminUsers}>
                          Reset
                        </Button>
                      </div>
                    </div>
                    {adminUsersError && (
                      <Card><CardContent className="py-4 text-center text-red-600">{adminUsersError}</CardContent></Card>
                    )}
                    {isLoadingAdminUsers ? (
                      <p className="text-center py-10 text-muted-foreground">Loading users...</p>
                    ) : adminUsers.length === 0 ? (
                      <Card><CardContent className="py-10 text-center text-muted-foreground">No users found. Click Search to load users.</CardContent></Card>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold">Name</th>
                              <th className="text-left px-4 py-3 font-semibold">Email</th>
                              <th className="text-left px-4 py-3 font-semibold">Role</th>
                              <th className="text-left px-4 py-3 font-semibold">Premium</th>
                              <th className="text-left px-4 py-3 font-semibold">Status</th>
                              <th className="text-left px-4 py-3 font-semibold">Wallet</th>
                              <th className="text-left px-4 py-3 font-semibold">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {adminUsers.map((u: any) => {
                              const isCombo = u.subscriptionType === 'combo';
                              const isBuyerPremium = u.isPremiumBuyer || isCombo;
                              const isSellerPremium = u.isPremiumSeller || isCombo;
                              const hasAnyPremium = isBuyerPremium || isSellerPremium;
                              const expiry = u.subscriptionExpiry ? new Date(u.subscriptionExpiry) : null;
                              const isExpired = expiry && expiry < new Date();
                              return (
                                <tr key={u._id} className={`hover:bg-muted/30 transition-colors ${hasAnyPremium && !isExpired ? 'bg-yellow-50/40 dark:bg-yellow-950/10' : ''}`}>
                                  <td className="px-4 py-3 font-medium">{u.name}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                      u.role === 'admin' ? 'bg-red-100 text-red-700' :
                                      u.role === 'seller' ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-100 text-gray-700'
                                    }`}>{u.role}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1">
                                      {isCombo && !isExpired && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border border-purple-200">
                                          👑 Combo
                                        </span>
                                      )}
                                      {!isCombo && isBuyerPremium && !isExpired && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                          ⭐ Buyer Pro
                                        </span>
                                      )}
                                      {!isCombo && isSellerPremium && !isExpired && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                          ⭐ Seller Pro
                                        </span>
                                      )}
                                      {hasAnyPremium && isExpired && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                          Expired
                                        </span>
                                      )}
                                      {!hasAnyPremium && (
                                        <span className="text-xs text-muted-foreground">Free</span>
                                      )}
                                    </div>
                                    {expiry && !isExpired && (
                                      <p className="text-xs text-muted-foreground mt-0.5">Until {expiry.toLocaleDateString()}</p>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${u.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {u.isActive !== false ? 'Active' : 'Suspended'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">₹{Number(u.walletBalance || 0).toFixed(2)}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {adminUsersTotalCount > adminUsers.length && (
                          <p className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
                            Showing {adminUsers.length} of {adminUsersTotalCount} users — use the search box to find others
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="stats">
                  {adminStatsError && (
                    <Card>
                      <CardContent className="py-4 text-center text-red-600">
                        {adminStatsError}
                      </CardContent>
                    </Card>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">Total Users</p>
                        <p className="text-2xl font-bold">
                          {isLoadingAdminStats ? "..." : adminStats?.totalUsers || 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">Total Notes</p>
                        <p className="text-2xl font-bold">
                          {isLoadingAdminStats ? "..." : adminStats?.totalNotes || 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">Pending Review</p>
                        <p className="text-2xl font-bold">
                          {isLoadingAdminStats ? "..." : adminStats?.pendingReview || 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold">
                          {isLoadingAdminStats ? "..." : `₹${Number(adminStats?.platformTotalEarnings ?? adminStats?.totalPlatformEarnings ?? adminStats?.totalRevenue ?? 0).toFixed(2)}`}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">Total Purchases</p>
                        <p className="text-2xl font-bold">
                          {isLoadingAdminStats ? "..." : adminStats?.totalPurchases || 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground">Open Tickets</p>
                        <p className="text-2xl font-bold">
                          {isLoadingAdminStats ? "..." : adminStats?.openTickets || 0}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center space-y-3 sm:space-y-4">
            <div className="border-t border-b border-gray-700 py-3 sm:py-4">
              <p className="text-xs sm:text-sm">© 2025 NotesMitra. All Rights Reserved.</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">Designed & Developed by NotesMitra</p>
            </div>
            <div className="flex justify-center flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => toast.info("Privacy Policy - Coming soon")}
                className="text-gray-300 hover:text-white p-1 sm:p-2"
              >
                Privacy Policy
              </Button>
              <span className="text-gray-600 hidden sm:inline">|</span>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => setShowTerms(true)}
                className="text-gray-300 hover:text-white p-1 sm:p-2"
              >
                Terms & Conditions
              </Button>
              <span className="text-gray-600 hidden sm:inline">|</span>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => toast.info("Refund Policy - Coming soon")}
                className="text-gray-300 hover:text-white p-1 sm:p-2"
              >
                Refund Policy
              </Button>
              <span className="text-gray-600 hidden sm:inline">|</span>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => setShowSupportDialog(true)}
                className="text-gray-300 hover:text-white p-1 sm:p-2"
              >
                Support
              </Button>
            </div>
          </div>
        </div>
      </footer>

      {/* Dialogs */}
      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => setShowAuthDialog(false)}
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleLogin}
      />

      <AdminLoginDialog
        isOpen={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onLogin={handleAdminLogin}
      />

      <ChangePassword
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onChangePassword={handleChangePassword}
      />

      <ResetPasswordDialog
        isOpen={!!resetPasswordToken || !!firebaseResetToken}
        token={resetPasswordToken || ''}
        firebaseToken={firebaseResetToken || undefined}
        onClose={() => { setResetPasswordToken(null); setFirebaseResetToken(null); }}
      />

      <TermsAndConditions
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
      />

      {premiumPaymentData && (
        <PremiumPaymentDialog
          isOpen={showPremiumPayment}
          onClose={() => {
            setShowPremiumPayment(false);
            setPremiumPaymentData(null);
          }}
          planType={premiumPaymentData.planType}
          amount={premiumPaymentData.amount}
          walletBalance={walletBalance}
          onPayment={(paymentId, method) => premiumPaymentData.onSuccess(paymentId, method)}
          showWalletOption={false}
          userName={currentUser?.name}
          userEmail={currentUser?.email}
          userPhone={currentUser?.phone}
          onSavePhone={handleSavePhone}
        />
      )}

      {/* Support Dialog */}
      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Support & Help
            </DialogTitle>
            <DialogDescription>
              Get assistance with any issues you may be facing.
            </DialogDescription>
          </DialogHeader>
          <Support
            userName={currentUser?.name || "Guest"}
            userEmail={currentUser?.email || ""}
            onSubmitTicket={handleSubmitTicket}
            tickets={supportTickets.filter(t => !currentUser?.email || t.userEmail === currentUser?.email)}
            isGuest={!currentUser}
            isLoading={isLoadingTickets}
            errorMessage={ticketsError}
          />
        </DialogContent>
      </Dialog>

      </Suspense>
    </div>
  );
}