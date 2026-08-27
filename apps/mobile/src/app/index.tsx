import { useAuth } from '@/bootstrap/auth';
import { AccountScreen } from '@/features/account/AccountScreen';
import { SignInScreen } from '@/features/auth/SignInScreen';

/** Single route: authentication state decides what is shown (SPEC-001 §12/§14). */
export default function IndexRoute() {
  const { state, auth, deletion } = useAuth();
  if (state === 'loading') return null;
  return state.status === 'authenticated' ? (
    <AccountScreen auth={auth} deletion={deletion} />
  ) : (
    <SignInScreen auth={auth} />
  );
}
