import type { Metadata } from 'next';
import AccountClient from '../../components/account/AccountClient';

export const metadata: Metadata = {
  title: 'My Orders | Navillera',
  description: 'See and manage your Navillera orders.',
  robots: { index: false },
};

export default function AccountPage() {
  return <AccountClient />;
}
