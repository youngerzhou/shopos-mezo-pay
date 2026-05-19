import { NextRequest, NextResponse } from 'next/server';
import { getSql, ensureDb, issueNewMemberCoupon } from '@/app/lib/db';
import { sendWelcomeEmail } from '@/app/lib/mailer';

export const dynamic = 'force-dynamic';

type ContactType = 'phone' | 'email';

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeContact(contact: string, contactType: ContactType) {
  const trimmed = contact.trim();
  return contactType === 'email' ? trimmed.toLowerCase() : trimmed;
}

function resolveContactType(contact: string, explicitType?: string): ContactType {
  if (explicitType === 'email' || explicitType === 'phone') return explicitType;
  return contact.includes('@') && isEmail(contact.trim()) ? 'email' : 'phone';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Backend: Received registration request", body);
    const { username, contact, staff_id } = body;

    if (!username || !contact) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contactType = resolveContactType(String(contact), body.contactType);
    const normalizedContact = normalizeContact(String(contact), contactType);
    if (contactType === 'email' && !isEmail(normalizedContact)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    await ensureDb();
    const sql = getSql();

    // If this contact already exists, return the existing member instead of creating a duplicate.
    const existingCustomer = contactType === 'email'
      ? await sql`SELECT * FROM customers WHERE LOWER(email) = ${normalizedContact} OR LOWER(contact_info) = ${normalizedContact} LIMIT 1`
      : await sql`SELECT * FROM customers WHERE phone = ${normalizedContact} OR contact_info = ${normalizedContact} LIMIT 1`;
    if (existingCustomer.length > 0) {
      return NextResponse.json(existingCustomer[0]);
    }

    // Generate unique MEM_ ID
    const referral_id = `MEM_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const id = Math.random().toString(36).substring(7);
    const welcomeToken = `wel_${Math.random().toString(36).substring(2, 12)}${Date.now().toString(36)}`;
    const phone = contactType === 'phone' ? normalizedContact : null;
    const email = contactType === 'email' ? normalizedContact : null;

    console.log("Backend: Attempting DB insert for contact", { contactType, normalizedContact });
    const result = await sql`
      INSERT INTO customers (
        id, username, contact_info, phone, email, referral_id, welcome_token, referred_by_staff_id
      )
      VALUES (
        ${id}, ${username}, ${normalizedContact}, ${phone}, ${email}, ${referral_id}, ${welcomeToken}, ${staff_id || null}
      )
      RETURNING *
    `;

    const customer = result[0];
    const issuedCoupon = await issueNewMemberCoupon(customer.wallet_address, customer.referral_id);

    if (contactType === 'email' && email) {
      sendWelcomeEmail({
        to: email,
        username: customer.username,
        welcomeToken
      }).catch((mailError) => {
        console.error('[Register] Welcome email failed', {
          customerId: customer.id,
          referralId: customer.referral_id,
          email,
          error: mailError
        });
      });
    }

    return NextResponse.json({ ...customer, issued_coupon: issuedCoupon || null });
  } catch (error: any) {
    console.error("Backend: DB Insert Error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const staff_id = searchParams.get('staff_id');
    const lookup = searchParams.get('lookup');
    const lookupType = searchParams.get('contactType');
    const welcomeToken = searchParams.get('welcome_token')?.trim();

    await ensureDb();
    const sql = getSql();

    if (welcomeToken) {
      const customer = await sql`SELECT * FROM customers WHERE welcome_token = ${welcomeToken} LIMIT 1`;
      return NextResponse.json(customer[0] || { error: 'Not found' });
    }

    if (lookup) {
      const contactType = resolveContactType(lookup, lookupType || undefined);
      const normalizedLookup = normalizeContact(lookup, contactType);
      const customer = contactType === 'email'
        ? await sql`SELECT * FROM customers WHERE LOWER(email) = ${normalizedLookup} OR LOWER(contact_info) = ${normalizedLookup} LIMIT 1`
        : await sql`SELECT * FROM customers WHERE phone = ${normalizedLookup} OR contact_info = ${normalizedLookup} LIMIT 1`;
      return NextResponse.json(customer[0] || { error: 'Not found' });
    }

    if (!staff_id) return NextResponse.json({ error: 'Missing staff_id' }, { status: 400 });

    const staff = await sql`SELECT username FROM staff WHERE staff_id = ${staff_id}`;
    return NextResponse.json(staff[0] || { username: 'Our Team' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
