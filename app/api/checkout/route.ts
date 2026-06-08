// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      cafeId, 
      cafeName, 
      itemPrice, 
      appFee,
      customerId,
      customerName,
      customerEmail,
      itemsOrdered
    } = body;

    // Kalkulasi Pass-on Fee (Gross Up untuk QRIS 0.7%)
    const targetBersih = itemPrice + appFee;
    const grossAmount = Math.ceil(targetBersih / 0.993); 
    
    const orderId = `AG-${Date.now()}`;

    // 1. Simpan data reservasi awal ke database jika Firebase Admin aktif
    if (adminDb) {
      await adminDb.collection('reservations').doc(orderId).set({
        orderId,
        cafeId,
        cafeName,
        customerId: customerId || 'guest-id',
        customerName: customerName || 'Pelanggan Anonim',
        customerEmail: customerEmail || 'guest@example.com',
        itemPrice,
        appFee,
        grossAmount,
        status: 'pending',
        payoutStatus: 'pending',
        createdAt: new Date().toISOString(),
        itemsOrdered: itemsOrdered || []
      });
    }

    // Payload untuk Midtrans Snap API
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: [
        {
          id: 'ITEM-1',
          price: grossAmount,
          quantity: 1,
          name: `Pesanan di ${cafeName}`,
        }
      ],
      // Paksa hanya menampilkan QRIS untuk prototipe ini
      enabled_payments: ["other_qris"], 
    };

    // Encode Server Key ke Base64
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const authString = Buffer.from(`${serverKey}:`).toString('base64');

    // Tembak Midtrans API
    const response = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_messages?.[0] || 'Gagal generate token Midtrans');
    }

    // Kembalikan token dan rincian transaksi untuk dicatat di frontend nanti
    return NextResponse.json({
      token: data.token,
      orderId,
      grossAmount,
      itemPrice,
      appFee,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}