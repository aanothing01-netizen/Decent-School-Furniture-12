import React, { useState, useEffect } from 'react';
import { StoreProvider } from './context/StoreContext';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { QuotationModal } from './components/QuotationModal';
import { CartDrawer } from './components/CartDrawer';
import { SearchModal } from './components/SearchModal';
import { ThemeInspectorModal } from './components/ThemeInspectorModal';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { Toast } from './components/Toast';

import { HomePage } from './pages/HomePage';
import { CataloguePage } from './pages/CataloguePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CustomOrdersPage } from './pages/CustomOrdersPage';
import { AboutPage } from './pages/AboutPage';
import { FaqsPage } from './pages/FaqsPage';
import { ContactPage } from './pages/ContactPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { CartPage } from './pages/CartPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { CustomerAccountPage } from './pages/CustomerAccountPage';
import { PRODUCTS } from './data/products';

export function AppContent() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const navigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Determine which page to render
  const renderPage = () => {
    // 1. Home
    if (currentPath === '/' || currentPath === '') {
      return <HomePage onNavigate={navigate} />;
    }

    // 2. Catalogue (All Products)
    if (currentPath === '/collections/all' || currentPath === '/collections' || currentPath === '/products') {
      return <CataloguePage initialCategory="all" onNavigate={navigate} />;
    }

    // 3. Category Specific Collections
    if (currentPath.startsWith('/collections/')) {
      const categoryHandle = currentPath.replace('/collections/', '');
      return <CataloguePage initialCategory={categoryHandle} onNavigate={navigate} />;
    }

    // 4. Product Details
    if (currentPath.startsWith('/products/')) {
      const handle = currentPath.replace('/products/', '');
      const product = PRODUCTS.find((p) => p.handle === handle) || PRODUCTS[0];
      return <ProductDetailPage product={product} onNavigate={navigate} />;
    }

    // 5. About Us
    if (currentPath === '/pages/about') {
      return <AboutPage onNavigate={navigate} />;
    }

    // 6. Projects & Gallery
    if (currentPath === '/pages/projects') {
      return <ProjectsPage onNavigate={navigate} />;
    }

    // 7. Custom Orders
    if (currentPath === '/pages/custom-orders') {
      return <CustomOrdersPage onNavigate={navigate} />;
    }

    // 8. FAQs
    if (currentPath === '/pages/faqs') {
      return <FaqsPage onNavigate={navigate} />;
    }

    // 9. Contact Us
    if (currentPath === '/pages/contact') {
      return <ContactPage onNavigate={navigate} />;
    }

    // 10. Privacy Policy
    if (currentPath === '/policies/privacy-policy') {
      return <PoliciesPage initialTab="privacy" onNavigate={navigate} />;
    }

    // 11. Terms and Conditions
    if (currentPath === '/policies/terms-of-service') {
      return <PoliciesPage initialTab="terms" onNavigate={navigate} />;
    }

    // 12. Cart Page
    if (currentPath === '/cart') {
      return <CartPage onNavigate={navigate} />;
    }

    // 13. Customer Authentication & Account Portal
    if (currentPath === '/account/login') {
      return <LoginPage onNavigate={navigate} />;
    }
    if (currentPath === '/account/register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    if (currentPath === '/account/recover' || currentPath === '/account/forgot-password') {
      return <ForgotPasswordPage onNavigate={navigate} />;
    }
    if (
      currentPath === '/account' ||
      currentPath === '/account/orders' ||
      currentPath === '/account/quotations'
    ) {
      return <CustomerAccountPage onNavigate={navigate} />;
    }

    // Fallback: 404
    return <NotFoundPage onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] text-[#243B53]">
      {/* Top Announcement Bar */}
      <AnnouncementBar onNavigate={navigate} />

      {/* Main Header */}
      <Header currentPath={currentPath} onNavigate={navigate} />

      {/* Main Body */}
      <main className="flex-grow">
        {renderPage()}
      </main>

      {/* Footer */}
      <Footer onNavigate={navigate} />

      {/* Modals & Overlays */}
      <QuotationModal />
      <CartDrawer onNavigate={navigate} />
      <SearchModal onNavigate={navigate} />
      <ThemeInspectorModal />
      <FloatingWhatsApp />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}
