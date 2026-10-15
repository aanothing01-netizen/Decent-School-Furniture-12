import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  CartItem,
  Product,
  ProductVariant,
  QuotationRequest,
  ThemeSettings,
  UserProfile,
  CustomerOrder,
} from '../types';
import { PRODUCTS } from '../data/products';

interface StoreContextType {
  // Auth & Profile
  user: User | null;
  userProfile: UserProfile | null;
  isAuthLoading: boolean;
  isLoggingIn: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    institution?: string;
    phone?: string;
    city?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfileData: (partial: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  logoutUser: () => Promise<void>;

  // Customer Orders & Quotations
  customerOrders: CustomerOrder[];
  userQuotations: QuotationRequest[];
  createOrderFromCart: (paymentMethod: string, address: string) => Promise<{ success: boolean; orderId: string }>;

  // Cart
  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number, variant?: ProductVariant, customNotes?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => void;

  // Quotation System
  isQuoteModalOpen: boolean;
  activeQuoteProduct: Product | null;
  activeQuoteQuantity: number;
  openQuoteModal: (product?: Product | null, quantity?: number) => void;
  closeQuoteModal: () => void;
  quotationRequests: QuotationRequest[];
  submitQuotation: (data: Omit<QuotationRequest, 'id' | 'createdAt' | 'status'>) => Promise<{ success: boolean; id: string }>;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Theme Settings
  themeSettings: ThemeSettings;
  updateThemeSettings: (partial: Partial<ThemeSettings>) => void;
  resetThemeSettings: () => void;

  // UI States
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  lightboxImage: { url: string; title?: string } | null;
  setLightboxImage: (img: { url: string; title?: string } | null) => void;
  isThemeInspectorOpen: boolean;
  setIsThemeInspectorOpen: (open: boolean) => void;
  isLiquidExportOpen: boolean;
  setIsLiquidExportOpen: (open: boolean) => void;

  // Toast
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  hideToast: () => void;

  // WhatsApp Helper
  getWhatsAppUrl: (message?: string) => string;
}

const defaultThemeSettings: ThemeSettings = {
  primaryColor: '#102A43',
  secondaryColor: '#486581',
  accentColor: '#F59E0B',
  announcementText: 'Quality School Furniture for a Brighter Tomorrow.',
  announcementLink: '/pages/custom-orders',
  showAnnouncement: true,
  phone: '+92 300 1234567',
  whatsapp: '923001234567',
  email: 'info@decentschoolfurniture.com',
  address: 'Industrial Area, Kot Lakhpat, Lahore, Pakistan',
  currencySymbol: 'PKR',
  freeShippingThreshold: 500000,
};

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userQuotations, setUserQuotations] = useState<QuotationRequest[]>([]);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [isLiquidExportOpen, setIsLiquidExportOpen] = useState(false);

  // Sync Auth and Firestore Profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            setUserProfile(snap.data() as UserProfile);
          } else {
            const initialProfile: UserProfile = {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'School Partner',
              role: (currentUser.email === 'aanothing01@gmail.com' || currentUser.email === 'xghost1704@gmail.com') ? 'admin' : 'customer',
              createdAt: new Date().toISOString(),
              accountMode: 'classic',
            };
            await setDoc(userDocRef, initialProfile, { merge: true });
            setUserProfile(initialProfile);
          }

          // Load user orders from storage or seed defaults
          const storageKey = `decent_orders_${currentUser.uid}`;
          const savedOrders = localStorage.getItem(storageKey);
          if (savedOrders) {
            try {
              setCustomerOrders(JSON.parse(savedOrders));
            } catch {
              setCustomerOrders([]);
            }
          } else {
            // Seed a representative institutional demo order
            const demoOrders: CustomerOrder[] = [
              {
                id: 'ord_' + Math.random().toString(36).substr(2, 9),
                orderNumber: 'DSF-PK-2025-1082',
                createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                items: [
                  {
                    title: 'Dual Student Desk & Chair Set (Grade 6-10)',
                    quantity: 25,
                    price: 13800,
                    variantName: 'Ocean Blue / Oak Finish',
                  },
                  {
                    title: 'Teacher Ergonomic Table with Drawer Unit',
                    quantity: 2,
                    price: 24500,
                    variantName: 'Standard Navy',
                  },
                ],
                subtotal: 394000,
                tax: 0,
                shipping: 15000,
                total: 409000,
                currency: 'PKR',
                status: 'in_production',
                paymentMethod: 'Bank Transfer / Purchase Order (DSF-PO-7721)',
                deliveryAddress: 'Main Campus, Model Town Extension, Lahore, Pakistan',
                trackingNumber: 'TCS-EXP-992384',
              },
            ];
            localStorage.setItem(storageKey, JSON.stringify(demoOrders));
            setCustomerOrders(demoOrders);
          }
        } catch (e) {
          console.warn('Failed to sync user document:', e);
        }
      } else {
        setUserProfile(null);
        setCustomerOrders([]);
        setUserQuotations([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to user quotations in real-time from Firestore when signed in
  useEffect(() => {
    if (!user) {
      setUserQuotations([]);
      return;
    }
    try {
      const q = query(collection(db, 'quotations'), where('userId', '==', user.uid));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const quotes: QuotationRequest[] = [];
          snapshot.forEach((docSnap) => {
            quotes.push(docSnap.data() as QuotationRequest);
          });
          quotes.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setUserQuotations(quotes);
        },
        (err) => {
          console.warn('Could not subscribe to personal quotations:', err);
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Quotation subscription error:', e);
    }
  }, [user]);

  // Google Sign In
  const loginWithGoogle = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      showToast(`Welcome back, ${cred.user.displayName || 'Customer'}!`, 'success');
    } catch (e: any) {
      const errorCode = e?.code || '';
      if (errorCode === 'auth/popup-blocked') {
        showToast('Sign-in popup was blocked by your browser. Please allow popups for this site.', 'error');
      } else if (errorCode !== 'auth/popup-closed-by-user') {
        console.error('Firebase Auth sign-in error:', e);
        showToast(e.message || 'Failed to sign in with Google', 'error');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Email & Password Login
  const loginWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (isLoggingIn) return { success: false, error: 'Sign in already in progress' };
    setIsLoggingIn(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast(`Welcome back, ${cred.user.displayName || cred.user.email}!`, 'success');
      return { success: true };
    } catch (e: any) {
      let friendlyMessage = 'Invalid email or password.';
      if (e?.code === 'auth/user-not-found' || e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        friendlyMessage = 'Incorrect email or password. Please verify and try again.';
      } else if (e?.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many failed login attempts. Please reset your password or try again later.';
      }
      return { success: false, error: friendlyMessage };
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Register Account
  const registerWithEmail = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    institution?: string;
    phone?: string;
    city?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (isLoggingIn) return { success: false, error: 'Registration already in progress' };
    setIsLoggingIn(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
      const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();

      await updateProfile(cred.user, {
        displayName: fullName,
      });

      const newProfile: UserProfile = {
        userId: cred.user.uid,
        email: cred.user.email || data.email.trim(),
        displayName: fullName,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        institution: data.institution?.trim() || '',
        phone: data.phone?.trim() || '',
        city: data.city?.trim() || '',
        role: 'customer',
        accountMode: 'classic',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      setUserProfile(newProfile);
      showToast('Account created successfully! Welcome to Decent School Furniture.', 'success');
      return { success: true };
    } catch (e: any) {
      let friendly = 'Failed to create account. Please try again.';
      if (e?.code === 'auth/email-already-in-use') {
        friendly = 'An account with this email address already exists. Please sign in instead.';
      } else if (e?.code === 'auth/weak-password') {
        friendly = 'Password is too weak. Please use at least 6 characters.';
      }
      return { success: false, error: friendly };
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Password Recovery
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showToast('Password reset instructions sent! Please check your inbox.', 'success');
      return { success: true };
    } catch (e: any) {
      let msg = 'Failed to send reset email. Please verify your address.';
      if (e?.code === 'auth/user-not-found') {
        msg = 'No customer account found with this email address.';
      }
      return { success: false, error: msg };
    }
  };

  // Update Profile Data
  const updateUserProfileData = async (partial: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User is not authenticated' };
    try {
      const ref = doc(db, 'users', user.uid);
      await setDoc(ref, partial, { merge: true });
      setUserProfile((prev) => (prev ? { ...prev, ...partial } : null));
      if (partial.displayName) {
        await updateProfile(user, { displayName: partial.displayName });
      }
      showToast('Profile updated successfully.', 'success');
      return { success: true };
    } catch (e: any) {
      console.error('Update profile error:', e);
      return { success: false, error: e.message || 'Failed to update profile' };
    }
  };

  const logoutUser = async () => {
    try {
      await signOut(auth);
      showToast('Signed out successfully', 'info');
    } catch (e: any) {
      console.error(e);
      showToast('Failed to sign out', 'error');
    }
  };

  // Create order from Cart
  const createOrderFromCart = async (paymentMethod: string, address: string): Promise<{ success: boolean; orderId: string }> => {
    if (cart.length === 0) return { success: false, orderId: '' };
    const orderNum = `DSF-PK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: CustomerOrder = {
      id: 'ord_' + Math.random().toString(36).substr(2, 9),
      orderNumber: orderNum,
      createdAt: new Date().toISOString(),
      items: cart.map((c) => ({
        title: c.product.title,
        quantity: c.quantity,
        price: c.product.price,
        image: c.product.images[0],
        variantName: c.variant?.name,
      })),
      subtotal: cartSubtotal,
      tax: 0,
      shipping: cartSubtotal >= themeSettings.freeShippingThreshold ? 0 : 5000,
      total: cartSubtotal + (cartSubtotal >= themeSettings.freeShippingThreshold ? 0 : 5000),
      currency: 'PKR',
      status: 'confirmed',
      paymentMethod,
      deliveryAddress: address,
      trackingNumber: `DSF-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
    };
    const targetUserUid = user ? user.uid : 'guest';
    const storageKey = `decent_orders_${targetUserUid}`;
    const existing = (() => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    })();
    const updated = [newOrder, ...existing];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    if (user) {
      setCustomerOrders(updated);
    }
    clearCart();
    return { success: true, orderId: newOrder.orderNumber };
  };

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('decent_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  // Quote Modal
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [activeQuoteProduct, setActiveQuoteProduct] = useState<Product | null>(null);
  const [activeQuoteQuantity, setActiveQuoteQuantity] = useState<number>(10);
  const [quotationRequests, setQuotationRequests] = useState<QuotationRequest[]>(() => {
    try {
      const saved = localStorage.getItem('decent_quotes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Wishlist
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('decent_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Theme Settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem('decent_theme_settings');
      return saved ? { ...defaultThemeSettings, ...JSON.parse(saved) } : defaultThemeSettings;
    } catch {
      return defaultThemeSettings;
    }
  });

  // UI
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string } | null>(null);
  const [isThemeInspectorOpen, setIsThemeInspectorOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Save Cart to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('decent_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  // Save Wishlist
  useEffect(() => {
    try {
      localStorage.setItem('decent_wishlist', JSON.stringify(wishlist));
    } catch (e) {
      console.error(e);
    }
  }, [wishlist]);

  // Save Quotes
  useEffect(() => {
    try {
      localStorage.setItem('decent_quotes', JSON.stringify(quotationRequests));
    } catch (e) {
      console.error(e);
    }
  }, [quotationRequests]);

  // Save Theme Settings
  useEffect(() => {
    try {
      localStorage.setItem('decent_theme_settings', JSON.stringify(themeSettings));
    } catch (e) {
      console.error(e);
    }
  }, [themeSettings]);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const hideToast = () => setToast(null);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => total + item.product.price * item.quantity, 0);

  const addToCart = (product: Product, quantity = 1, variant?: ProductVariant, customNotes?: string) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.variant?.id === variant?.id
      );
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          customNotes: customNotes || next[existingIndex].customNotes,
        };
        return next;
      }
      return [
        ...prev,
        {
          product,
          variant: variant || product.variants[0],
          quantity,
          customNotes,
        },
      ];
    });
    showToast(`Added ${quantity}x "${product.title}" to Cart`);
    setIsCartDrawerOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId && (!variantId || item.variant?.id === variantId)) {
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && (!variantId || item.variant?.id === variantId)))
    );
    showToast('Item removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const openQuoteModal = (product?: Product | null, quantity = 10) => {
    setActiveQuoteProduct(product || null);
    setActiveQuoteQuantity(quantity);
    setIsQuoteModalOpen(true);
  };

  const closeQuoteModal = () => {
    setIsQuoteModalOpen(false);
    setActiveQuoteProduct(null);
  };

  const submitQuotation = async (
    data: Omit<QuotationRequest, 'id' | 'createdAt' | 'status'>
  ): Promise<{ success: boolean; id: string }> => {
    const id = `DSF-${Date.now().toString().slice(-6)}`;
    const newRequest: QuotationRequest = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    setQuotationRequests((prev) => [newRequest, ...prev]);

    try {
      await setDoc(doc(db, 'quotations', id), {
        ...newRequest,
        userId: auth.currentUser?.uid || null,
      });
    } catch (error) {
      console.warn('Could not save to Firestore, continuing with local confirmation:', error);
    }
    showToast(`Quote request #${id} submitted successfully! We will contact you shortly.`);
    return { success: true, id };
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        showToast('Removed from wishlist', 'info');
        return prev.filter((id) => id !== productId);
      } else {
        const prod = PRODUCTS.find((p) => p.id === productId);
        showToast(`Added ${prod?.title || 'product'} to wishlist`, 'success');
        return [...prev, productId];
      }
    });
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  const updateThemeSettings = (partial: Partial<ThemeSettings>) => {
    setThemeSettings((prev) => ({ ...prev, ...partial }));
    showToast('Theme settings updated', 'info');
  };

  const resetThemeSettings = () => {
    setThemeSettings(defaultThemeSettings);
    showToast('Theme settings reset to default', 'info');
  };

  const getWhatsAppUrl = (customMessage?: string) => {
    const cleanNumber = themeSettings.whatsapp.replace(/\D/g, '');
    const defaultText = `Hello Decent School Furniture! I am interested in inquiring about institutional furniture for our school/college.`;
    const text = encodeURIComponent(customMessage || defaultText);
    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <StoreContext.Provider
      value={{
        user,
        userProfile,
        isAuthLoading,
        isLoggingIn,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        updateUserProfileData,
        logoutUser,
        customerOrders,
        userQuotations,
        createOrderFromCart,
        cart,
        cartCount,
        cartSubtotal,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        isQuoteModalOpen,
        activeQuoteProduct,
        activeQuoteQuantity,
        openQuoteModal,
        closeQuoteModal,
        quotationRequests,
        submitQuotation,
        wishlist,
        toggleWishlist,
        isInWishlist,
        themeSettings,
        updateThemeSettings,
        resetThemeSettings,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isSearchOpen,
        setIsSearchOpen,
        searchQuery,
        setSearchQuery,
        lightboxImage,
        setLightboxImage,
        isThemeInspectorOpen,
        setIsThemeInspectorOpen,
        isLiquidExportOpen,
        setIsLiquidExportOpen,
        toast,
        showToast,
        hideToast,
        getWhatsAppUrl,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
