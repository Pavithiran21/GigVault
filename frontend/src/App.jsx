import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth } from './auth/RouteGuards';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { ClientsPage } from './features/clients/ClientsPage';
import { EarningsPage } from './features/earnings/EarningsPage';
import { GigsPage } from './features/gigs/GigsPage';
import { PaymentsPage } from './features/payments/PaymentsPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { AppShell } from './layout/AppShell';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>
      {/* Open while logged in too: a reset link must work in a browser that has a session. */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<EarningsPage />} />
          <Route path="gigs" element={<GigsPage />} />
          <Route path="gigs/new" element={<GigsPage />} />
          <Route path="gigs/:gigId" element={<GigsPage />} />
          <Route path="gigs/:gigId/edit" element={<GigsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:clientId" element={<ClientsPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
