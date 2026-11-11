import type { Metadata } from 'next';
import OrderLinkClient from '../../../components/account/OrderLinkClient';

export const metadata: Metadata = {
  title: 'Your Order | Navillera',
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderLinkClient token={token} />;
}
