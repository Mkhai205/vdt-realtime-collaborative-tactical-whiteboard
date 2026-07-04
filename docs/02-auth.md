# 🔐 Plan 02 — Authentication

> **Ưu tiên**: 🔴 Critical  
> **Ước tính**: 0.5 ngày  
> **Phụ thuộc**: Plan 01 (Foundation)

---

## 🎯 Mục tiêu

Implement luồng đăng nhập Google OAuth hoàn chỉnh:
1. Login page với Google button đẹp
2. Auth state management (Zustand)
3. Route protection (redirect `/login` nếu chưa đăng nhập)
4. Auto-refresh token khi app khởi động

---

## 🔄 Auth Flow

```
/login page
    ↓ User click "Continue with Google"
GoogleOAuthProvider → GoogleLogin component
    ↓ Google trả về idToken (credential)
POST /auth/google { idToken }
    ↓ Server trả về { accessToken, user }
    → Server set HttpOnly cookie: refresh_token
Store accessToken + user vào Zustand (persist)
    ↓
Redirect → /dashboard
```

### Token Refresh khi app load
```
App load → check localStorage có user?
    → YES: gọi POST /auth/refresh để lấy accessToken mới
        → SUCCESS: update store, tiếp tục
        → FAIL: clearAuth, redirect /login
    → NO: redirect /login (nếu page yêu cầu auth)
```

---

## 📁 Files cần tạo

### `features/auth/api/auth.api.ts`
```typescript
// loginWithGoogle(idToken: string): Promise<LoginResponse>
//   → POST /auth/google { idToken }

// refreshToken(): Promise<RefreshResponse>
//   → POST /auth/refresh (cookie tự động gửi)

// logout(): Promise<void>
//   → POST /auth/logout (revoke cookie)
```

### `features/auth/store/auth.store.ts`
- Đã định nghĩa ở Plan 01, di chuyển vào đây nếu muốn tách

### `features/auth/hooks/useAuth.ts`
```typescript
// Hook tập hợp auth actions:
export function useAuth() {
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();

  const loginWithGoogle = async (idToken: string) => {
    const { user, accessToken } = await authApi.loginWithGoogle(idToken);
    setAuth(user, accessToken);
    router.push('/dashboard');
  };

  const logout = async () => {
    await authApi.logout();
    clearAuth();
    router.push('/login');
  };

  return { user, isAuthenticated: !!accessToken, loginWithGoogle, logout };
}
```

### `features/auth/hooks/useInitAuth.ts`
```typescript
// Chạy một lần khi app mount:
// 1. Nếu có user trong store → POST /auth/refresh
// 2. Update accessToken hoặc clearAuth
// 3. Set isLoading = false
// Dùng trong root layout
```

### `features/auth/components/GoogleLoginButton.tsx`
```tsx
// @react-oauth/google GoogleLogin wrapper
// Thiết kế: nút Google đẹp với icon, loading state
// onSuccess → gọi useAuth().loginWithGoogle(credential)
// onError → toast.error()
```

### `app/(auth)/login/page.tsx`
```
Design:
- Background: gradient nhẹ (trắng sang gray-50)
- Center card glassmorphism
- Logo + tên app
- Tagline: "Collaborate in real time, create without limits"
- Nút "Continue with Google" (Google branding)
- Footer: "By continuing, you agree to Terms of Service"
```

**Yêu cầu visual**:
- Animated gradient background (subtle, không rối mắt)
- Card shadow mềm
- Nút Google hover animation
- Loading spinner khi đang xử lý OAuth

### `components/common/auth-guard.tsx`
```typescript
// HOC hoặc wrapper component
// Kiểm tra isAuthenticated từ store
// Nếu chưa auth → redirect /login
// Nếu đang check (isLoading) → skeleton screen
// Dùng để wrap dashboard và board pages
```

### `providers/auth-provider.tsx`
```typescript
// Wrap app, gọi useInitAuth() để bootstrap auth state
// Hiển thị loading spinner toàn trang khi đang check auth
```

---

## 🖼️ UI Design Spec — Login Page

```
┌─────────────────────────────────────┐
│  [Animated gradient background]      │
│                                      │
│  ┌───────────────────────────────┐   │
│  │  🎨 RCTW                      │   │
│  │  Realtime Collaborative        │   │
│  │  Whiteboard                    │   │
│  │                                │   │
│  │  ────────────────────────────  │   │
│  │                                │   │
│  │  Collaborate in real time,     │   │
│  │  create without limits.        │   │
│  │                                │   │
│  │  [G] Continue with Google      │   │
│  │                                │   │
│  │  ─── or ───                    │   │
│  │                                │   │
│  │  [Share a board link? Join →]  │   │
│  └───────────────────────────────┘   │
│                                      │
└─────────────────────────────────────┘
```

---

## 🛡️ Route Protection Strategy

Dùng Next.js middleware (`middleware.ts`):

```typescript
// Protect routes: /dashboard, /board/*
// Public routes: /login, /invitations/accept
// Nếu không có token → redirect /login
// Nếu đã login và vào /login → redirect /dashboard
```

---

## ✅ Acceptance Criteria

- [ ] Login page hiển thị đúng thiết kế
- [ ] Click "Continue with Google" mở Google OAuth popup
- [ ] Sau login thành công → redirect dashboard
- [ ] Refresh page → vẫn giữ session (nhờ refresh token)
- [ ] Logout → clearAuth, redirect /login, cookie bị revoke
- [ ] Truy cập /dashboard khi chưa login → redirect /login
- [ ] Truy cập /login khi đã login → redirect /dashboard
