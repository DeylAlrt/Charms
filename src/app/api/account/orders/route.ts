import { NextRequest, NextResponse } from 'next/server';
import { applyRenewal, getCustomer } from '@/lib/customerAuth';
import { customerOrders } from '@/lib/orderStore';

/** The signed-in customer's orders (every order placed with their email). */
export async function GET(request: NextRequest) {
  try {
    const customer = await getCustomer(request);
    if (!customer) return NextResponse.json({ success: false, signedIn: false });
    const orders = await customerOrders(customer.email);
    return applyRenewal(NextResponse.json({ success: true, signedIn: true, email: customer.email, orders }), customer);
  } catch (err) {
    console.error('Could not load the customer orders:', err);
    return NextResponse.json({ success: false, error: 'We could not load your orders right now — please try again.' }, { status: 500 });
  }
}
