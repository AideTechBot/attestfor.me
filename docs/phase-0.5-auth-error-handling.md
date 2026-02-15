# Phase 0.5: Authentication & Error Handling — Detailed Implementation Guide

**Objective:** Implement graceful authentication error handling, preserve user context during OAuth flows, and provide user-friendly error messages instead of raw JSON responses.

**Prerequisites:**
- Phase 0 completed (Client/Server Architecture)
- Basic OAuth implementation in place

---

## Problem Statement

Currently, authentication errors result in:
- ❌ Raw JSON responses shown to users
- ❌ Users redirected away from their original page
- ❌ No way to retry authentication
- ❌ Confusing error messages
- ❌ Loss of user context (what they were trying to do)

**Goal:** Users should be gracefully returned to their original page with clear, actionable error messages.

---

## Task 0.5.1: OAuth Flow with Return URL Preservation

### Location
Update file: `server/oauth.ts`

### Implementation

```typescript
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { Request, Response } from 'express';

// Store the intended destination before OAuth redirect
export function handleLogin(req: Request, res: Response) {
  // Capture return URL from query param or referer
  const returnTo = req.query.returnTo as string || req.headers.referer || '/';
  
  // Store in session for retrieval after OAuth callback
  req.session.returnTo = returnTo;
  req.session.loginAttemptedAt = new Date().toISOString();
  
  // Generate OAuth authorization URL
  const authUrl = await oauthClient.authorize(req.session.did || 'unknown', {
    scope: 'atproto transition:generic',
  });
  
  res.redirect(authUrl);
}

// OAuth callback handler
export async function handleCallback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;
  
  // Retrieve original return URL from session
  const returnTo = req.session.returnTo || '/';
  const loginAttemptedAt = req.session.loginAttemptedAt;
  
  // Clear session values
  delete req.session.returnTo;
  delete req.session.loginAttemptedAt;
  
  // Handle OAuth errors
  if (error) {
    return res.redirect(
      `${returnTo}?auth_error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || 'Authentication failed')}`
    );
  }
  
  try {
    // Exchange code for tokens
    const result = await oauthClient.callback(code as string, state as string);
    
    // Store session
    req.session.did = result.session.did;
    req.session.accessToken = result.tokens.accessToken;
    req.session.refreshToken = result.tokens.refreshToken;
    
    // Log successful authentication
    console.log(`[Auth] User ${result.session.did} authenticated successfully`);
    
    // Redirect back to original page with success indicator
    res.redirect(`${returnTo}?auth_success=true`);
    
  } catch (err: any) {
    console.error('[Auth] OAuth callback error:', err);
    
    // Determine user-friendly error message
    let errorMessage = 'Authentication failed. Please try again.';
    let errorCode = 'auth_failed';
    
    if (err.message?.includes('network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
      errorCode = 'network_error';
    } else if (err.message?.includes('expired')) {
      errorMessage = 'Authentication session expired. Please try again.';
      errorCode = 'session_expired';
    } else if (err.message?.includes('invalid')) {
      errorMessage = 'Invalid authentication response. Please try again.';
      errorCode = 'invalid_response';
    }
    
    // Redirect with error
    res.redirect(
      `${returnTo}?auth_error=${errorCode}&error_message=${encodeURIComponent(errorMessage)}`
    );
  }
}

// Middleware to check authentication and handle expired sessions
export function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.did || !req.session.accessToken) {
    // Store current URL for return after login
    const returnTo = req.originalUrl;
    
    // Return JSON for API requests
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'You must be logged in to perform this action',
        loginUrl: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
      });
    }
    
    // Redirect to login for page requests
    return res.redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  
  // Check if token is expired (if we track expiration)
  if (req.session.tokenExpiresAt && Date.now() > req.session.tokenExpiresAt) {
    console.log(`[Auth] Token expired for ${req.session.did}, attempting refresh`);
    
    // Attempt token refresh
    return refreshAuthToken(req, res, next);
  }
  
  next();
}

// Token refresh helper
async function refreshAuthToken(req: Request, res: Response, next: Function) {
  const returnTo = req.originalUrl;
  
  try {
    const result = await oauthClient.refresh(req.session.refreshToken);
    
    // Update session
    req.session.accessToken = result.tokens.accessToken;
    req.session.refreshToken = result.tokens.refreshToken;
    req.session.tokenExpiresAt = Date.now() + (result.tokens.expiresIn * 1000);
    
    console.log(`[Auth] Token refreshed for ${req.session.did}`);
    next();
    
  } catch (err: any) {
    console.error('[Auth] Token refresh failed:', err);
    
    // Clear invalid session
    req.session.destroy(() => {
      // Return JSON for API requests
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          error: 'session_expired',
          message: 'Your session has expired. Please log in again.',
          loginUrl: `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
        });
      }
      
      // Redirect to login
      res.redirect(
        `/auth/login?returnTo=${encodeURIComponent(returnTo)}&auth_error=session_expired&error_message=${encodeURIComponent('Your session has expired. Please log in again.')}`
      );
    });
  }
}
```

---

## Task 0.5.2: Error Handling Middleware

### Location
Create file: `server/middleware/error-handler.ts`

### Implementation

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

// Global error handler
export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  // Log error
  console.error('[Error]', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    user: req.session?.did,
    stack: err.stack,
  });
  
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'internal_error';
  
  // For API requests, return JSON
  if (req.path.startsWith('/api/')) {
    return res.status(statusCode).json({
      error: errorCode,
      message: getUserFriendlyMessage(err),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
  
  // For page requests, render error page
  res.status(statusCode).render('error', {
    statusCode,
    errorCode,
    message: getUserFriendlyMessage(err),
    canRetry: err.isOperational !== false,
    returnUrl: req.originalUrl,
  });
}

// Convert technical errors to user-friendly messages
function getUserFriendlyMessage(err: AppError): string {
  // Known error codes
  const errorMessages: Record<string, string> = {
    'authentication_required': 'You need to log in to access this page.',
    'session_expired': 'Your session has expired. Please log in again.',
    'invalid_token': 'Your authentication is invalid. Please log in again.',
    'network_error': 'Network error. Please check your connection and try again.',
    'rate_limit_exceeded': 'Too many requests. Please wait a moment and try again.',
    'not_found': 'The requested resource was not found.',
    'forbidden': 'You do not have permission to access this resource.',
    'bad_request': 'Invalid request. Please check your input and try again.',
    'proof_verification_failed': 'Proof verification failed. Please check the proof URL and try again.',
    'invalid_signature': 'Invalid signature. Please ensure you signed the correct message.',
    'invalid_key_format': 'Invalid key format. Please check your public key and try again.',
  };
  
  if (err.code && errorMessages[err.code]) {
    return errorMessages[err.code];
  }
  
  // Default messages by status code
  if (err.statusCode === 401) {
    return 'Authentication required. Please log in.';
  } else if (err.statusCode === 403) {
    return 'You do not have permission to perform this action.';
  } else if (err.statusCode === 404) {
    return 'The requested resource was not found.';
  } else if (err.statusCode === 429) {
    return 'Too many requests. Please slow down and try again.';
  }
  
  // Generic fallback
  return 'An error occurred. Please try again later.';
}

// Async error wrapper (catches async errors in route handlers)
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
export function notFoundHandler(req: Request, res: Response) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'not_found',
      message: 'API endpoint not found',
      path: req.path,
    });
  }
  
  res.status(404).render('404', {
    path: req.path,
  });
}
```

---

## Task 0.5.3: Frontend Error Handling (Toast Notifications)

### Location
Create file: `src/lib/error-handler.ts`

### Implementation

```typescript
import { toast } from 'sonner'; // or your preferred toast library

export interface ErrorResponse {
  error: string;
  message: string;
  loginUrl?: string;
}

// Handle API errors
export async function handleApiError(response: Response): Promise<never> {
  let errorData: ErrorResponse;
  
  try {
    errorData = await response.json();
  } catch {
    errorData = {
      error: 'unknown_error',
      message: 'An unexpected error occurred',
    };
  }
  
  // Show toast notification
  showErrorToast(errorData);
  
  // Throw error for caller to handle
  throw new Error(errorData.message);
}

// Show error toast with appropriate actions
export function showErrorToast(error: ErrorResponse) {
  const { error: code, message, loginUrl } = error;
  
  // Authentication errors
  if (code === 'authentication_required' || code === 'session_expired') {
    toast.error(message, {
      action: loginUrl ? {
        label: 'Log In',
        onClick: () => {
          window.location.href = loginUrl;
        },
      } : undefined,
      duration: 10000, // 10 seconds
    });
    return;
  }
  
  // Rate limit errors
  if (code === 'rate_limit_exceeded') {
    toast.error(message, {
      duration: 5000,
    });
    return;
  }
  
  // Network errors
  if (code === 'network_error') {
    toast.error(message, {
      action: {
        label: 'Retry',
        onClick: () => {
          window.location.reload();
        },
      },
      duration: 8000,
    });
    return;
  }
  
  // Generic errors
  toast.error(message, {
    duration: 5000,
  });
}

// Check URL params for auth errors (from OAuth callback)
export function checkAuthErrorParams() {
  const params = new URLSearchParams(window.location.search);
  
  const authError = params.get('auth_error');
  const errorMessage = params.get('error_message');
  const authSuccess = params.get('auth_success');
  
  // Remove error params from URL (clean up)
  if (authError || authSuccess) {
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }
  
  // Show success message
  if (authSuccess === 'true') {
    toast.success('Successfully logged in!', {
      duration: 3000,
    });
    return;
  }
  
  // Show error message
  if (authError) {
    const message = errorMessage || 'Authentication failed. Please try again.';
    toast.error(message, {
      action: {
        label: 'Retry',
        onClick: () => {
          window.location.href = `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
        },
      },
      duration: 10000,
    });
  }
}

// Wrap fetch with error handling
export async function fetchWithErrorHandling(url: string, options?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Always include credentials
    });
    
    if (!response.ok) {
      await handleApiError(response);
    }
    
    return response;
  } catch (error: any) {
    // Network error
    if (error.message === 'Failed to fetch') {
      showErrorToast({
        error: 'network_error',
        message: 'Network error. Please check your connection and try again.',
      });
    }
    throw error;
  }
}
```

### Location
Update file: `src/entry-client.tsx`

### Implementation

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner'; // Add toast library
import { checkAuthErrorParams } from './lib/error-handler';
import App from './App';

// Check for auth errors on page load
checkAuthErrorParams();

ReactDOM.hydrateRoot(
  document.getElementById('root')!,
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-right" />
    </BrowserRouter>
  </React.StrictMode>
);
```

---

## Task 0.5.4: Error Pages

### Location
Create file: `src/pages/ErrorPage.tsx`

### Implementation

```typescript
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface ErrorPageProps {
  statusCode?: number;
  errorCode?: string;
  message?: string;
  canRetry?: boolean;
}

export function ErrorPage({
  statusCode = 500,
  errorCode = 'unknown_error',
  message = 'An unexpected error occurred',
  canRetry = true,
}: ErrorPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleRetry = () => {
    window.location.reload();
  };
  
  const handleGoHome = () => {
    navigate('/');
  };
  
  const handleGoBack = () => {
    navigate(-1);
  };
  
  const getErrorIcon = () => {
    if (statusCode === 401 || errorCode.includes('auth')) {
      return '🔒';
    } else if (statusCode === 404) {
      return '🔍';
    } else if (statusCode === 403) {
      return '🚫';
    } else if (statusCode === 429) {
      return '⏱️';
    }
    return '❌';
  };
  
  const getErrorTitle = () => {
    if (statusCode === 401) {
      return 'Authentication Required';
    } else if (statusCode === 404) {
      return 'Page Not Found';
    } else if (statusCode === 403) {
      return 'Access Denied';
    } else if (statusCode === 429) {
      return 'Too Many Requests';
    }
    return 'Something Went Wrong';
  };
  
  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-icon">{getErrorIcon()}</div>
        <h1 className="error-title">{getErrorTitle()}</h1>
        <p className="error-code">Error Code: {errorCode}</p>
        <p className="error-message">{message}</p>
        
        <div className="error-actions">
          {canRetry && (
            <button onClick={handleRetry} className="btn-primary">
              Try Again
            </button>
          )}
          <button onClick={handleGoBack} className="btn-secondary">
            Go Back
          </button>
          <button onClick={handleGoHome} className="btn-secondary">
            Go Home
          </button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="error-details">
            <summary>Debug Information</summary>
            <pre>
              {JSON.stringify(
                {
                  statusCode,
                  errorCode,
                  message,
                  path: location.pathname,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              )}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
```

**CSS:** Add to `src/index.css`:

```css
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.error-container {
  max-width: 600px;
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.error-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #333;
}

.error-code {
  font-family: monospace;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}

.error-message {
  font-size: 1.1rem;
  color: #555;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.error-details {
  margin-top: 2rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: left;
}

.error-details summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 1rem;
}

.error-details pre {
  font-size: 0.85rem;
  overflow-x: auto;
}
```

---

## Task 0.5.5: Session Debugging UI (Development Only)

### Location
Create file: `src/components/AuthDebugPanel.tsx`

### Implementation

```typescript
import React, { useState, useEffect } from 'react';

export function AuthDebugPanel() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  useEffect(() => {
    // Listen for keyboard shortcut: Ctrl+Shift+D
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setVisible((prev) => !prev);
        if (!visible) {
          fetchSessionInfo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);
  
  const fetchSessionInfo = async () => {
    try {
      const response = await fetch('/api/debug/session', {
        credentials: 'include',
      });
      const data = await response.json();
      setSessionInfo(data);
    } catch (err) {
      setSessionInfo({ error: 'Failed to fetch session info' });
    }
  };
  
  const handleClearSession = async () => {
    if (confirm('Clear session and log out?')) {
      await fetch('/api/debug/clear-session', {
        method: 'POST',
        credentials: 'include',
      });
      window.location.reload();
    }
  };
  
  const handleRefreshToken = async () => {
    try {
      await fetch('/api/debug/refresh-token', {
        method: 'POST',
        credentials: 'include',
      });
      alert('Token refreshed successfully');
      fetchSessionInfo();
    } catch (err) {
      alert('Token refresh failed');
    }
  };
  
  if (!visible) {
    return (
      <div className="auth-debug-hint">
        Press <kbd>Ctrl+Shift+D</kbd> to show auth debug panel
      </div>
    );
  }
  
  return (
    <div className="auth-debug-panel">
      <div className="auth-debug-header">
        <h3>Authentication Debug Panel</h3>
        <button onClick={() => setVisible(false)}>✕</button>
      </div>
      
      <div className="auth-debug-content">
        {sessionInfo ? (
          <pre>{JSON.stringify(sessionInfo, null, 2)}</pre>
        ) : (
          <p>Loading session info...</p>
        )}
      </div>
      
      <div className="auth-debug-actions">
        <button onClick={fetchSessionInfo} className="btn-sm">
          Refresh
        </button>
        <button onClick={handleRefreshToken} className="btn-sm">
          Refresh Token
        </button>
        <button onClick={handleClearSession} className="btn-sm btn-danger">
          Clear Session
        </button>
      </div>
    </div>
  );
}
```

**Debug API endpoints** — Add to `server/routes/debug.ts`:

```typescript
import { Router, Request, Response } from 'express';

const router = Router();

// Only enable in development
if (process.env.NODE_ENV === 'development') {
  router.get('/session', (req: Request, res: Response) => {
    res.json({
      authenticated: !!req.session.did,
      did: req.session.did || null,
      hasAccessToken: !!req.session.accessToken,
      hasRefreshToken: !!req.session.refreshToken,
      tokenExpiresAt: req.session.tokenExpiresAt || null,
      sessionID: req.sessionID,
      cookie: req.session.cookie,
    });
  });
  
  router.post('/clear-session', (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });
  
  router.post('/refresh-token', async (req: Request, res: Response) => {
    try {
      // Call actual token refresh logic
      const result = await oauthClient.refresh(req.session.refreshToken);
      req.session.accessToken = result.tokens.accessToken;
      req.session.refreshToken = result.tokens.refreshToken;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

export default router;
```

**CSS:** Add to `src/index.css`:

```css
.auth-debug-hint {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: #333;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.85rem;
  opacity: 0.7;
  pointer-events: none;
}

.auth-debug-hint kbd {
  background: #555;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  font-family: monospace;
}

.auth-debug-panel {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  width: 500px;
  max-height: 600px;
  background: white;
  border: 2px solid #333;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  display: flex;
  flex-direction: column;
}

.auth-debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
  background: #f5f5f5;
}

.auth-debug-header h3 {
  margin: 0;
  font-size: 1rem;
}

.auth-debug-header button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
}

.auth-debug-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.auth-debug-content pre {
  margin: 0;
  font-size: 0.85rem;
  font-family: monospace;
}

.auth-debug-actions {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #ddd;
  background: #f5f5f5;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.btn-sm:hover {
  background: #f0f0f0;
}

.btn-danger {
  background: #ff4444;
  color: white;
  border-color: #cc0000;
}

.btn-danger:hover {
  background: #cc0000;
}
```

---

## Task 0.5.6: Network Error Detection

### Location
Create file: `src/lib/network-status.ts`

### Implementation

```typescript
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

// Offline indicator component
export function OfflineIndicator() {
  const isOnline = useNetworkStatus();
  
  if (isOnline) {
    return null;
  }
  
  return (
    <div className="offline-indicator">
      <span>⚠️</span>
      <span>No internet connection</span>
    </div>
  );
}
```

**CSS:** Add to `src/index.css`:

```css
.offline-indicator {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #ff9800;
  color: white;
  padding: 0.75rem;
  text-align: center;
  font-weight: 600;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
```

---

## Acceptance Criteria

Phase 0.5 is complete when:

**OAuth Flow:**
- [ ] Login preserves returnTo URL in session
- [ ] After successful login, user is redirected to original page
- [ ] OAuth errors redirect to original page with error message
- [ ] Success/error params are shown as toast notifications
- [ ] URL is cleaned after showing toast (no error params in URL)

**Error Handling:**
- [ ] No raw JSON responses shown to users
- [ ] All API errors return user-friendly messages
- [ ] Error middleware catches all unhandled errors
- [ ] 404 handler shows custom page (not default browser 404)
- [ ] API 401 errors include loginUrl in response
- [ ] Page 401 errors redirect to login with returnTo

**Token Management:**
- [ ] Expired tokens trigger automatic refresh attempt
- [ ] Failed refresh redirects to login with error message
- [ ] requireAuth middleware checks token expiration
- [ ] Token refresh preserves user's current page

**Frontend:**
- [ ] Auth error params checked on page load
- [ ] Toast notifications show for auth errors
- [ ] Toast includes "Retry" action for auth errors
- [ ] fetchWithErrorHandling wrapper available
- [ ] Network errors detected and shown
- [ ] Offline indicator displays when no connection

**Error Pages:**
- [ ] ErrorPage component handles all error types
- [ ] Error icon/title appropriate for error type
- [ ] "Try Again" button works (refreshes page)
- [ ] "Go Back" button works (history back)
- [ ] "Go Home" button works (navigate to /)
- [ ] Debug info shown in development mode only

**Development Tools:**
- [ ] Auth debug panel accessible with Ctrl+Shift+D
- [ ] Session info displayed in debug panel
- [ ] "Clear Session" button logs user out
- [ ] "Refresh Token" button works
- [ ] Debug API endpoints only enabled in development

**Testing:**
- [ ] OAuth error scenarios tested (invalid code, network error, etc.)
- [ ] Token expiration handled gracefully
- [ ] Session loss detected and handled
- [ ] Network offline/online transitions work
- [ ] All error types show appropriate messages
- [ ] returnTo parameter preserved through full OAuth flow

---

## Next Phase

Proceed to **Phase 1: Foundation** after all acceptance criteria are met.
