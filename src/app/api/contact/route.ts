import { NextRequest, NextResponse } from 'next/server';
import { sendOrderNotificationEmail } from '@/lib/emailNotify';
import { checkSpam, isEmail, noteSend, text } from '@/lib/antiSpam';
import { CORS_HEADERS } from '@/lib/shopOrder';

/** The main site's contact form (FAQs and About Us pages, Js_Folder/contact-form.js). */

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const headers = CORS_HEADERS;
  const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers });

  try {
    const body = await request.json();
    const spam = await checkSpam(request, body, 'contact');
    if (!spam.ok) return spam.silent ? NextResponse.json({ success: true }, { headers }) : fail(spam.error, spam.status);

    const name = text(body.name, 100);
    const email = text(body.email, 254);
    const message = text(body.message, 3000);
    if (!name || !email || !message) return fail('Please fill in your name, email and message.');
    if (!isEmail(email)) return fail('Please check your email address.');

    await sendOrderNotificationEmail({
      name,
      title: 'New Contact Form Message',
      time: new Date().toLocaleString('en-AE', { timeZone: 'Asia/Dubai' }),
      email,
      message,
    }, 'contact');
    noteSend(request, 'contact');
    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error('Error sending contact message:', error);
    return fail('Something went wrong sending your message — please try again or email us directly.', 500);
  }
}
