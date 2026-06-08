// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Ambil data penting dari payload Midtrans
    const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

    // 2. Buat SHA512 Hash untuk memvalidasi bahwa request ini BENAR dari Midtrans
    // Rumus Midtrans: SHA512(order_id + status_code + gross_amount + ServerKey)
    const hashData = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const generatedSignature = crypto.createHash('sha512').update(hashData).digest('hex');

    if (generatedSignature !== signature_key) {
      console.error('🚨 Akses Ditolak: Signature Midtrans tidak valid!');
      return NextResponse.json({ message: 'Invalid signature' }, { status: 403 });
    }

    // 3. Cek Status Transaksi
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      console.log(`✅ [WEBHOOK] Pembayaran Berhasil! Order ID: ${order_id}, Nominal: ${gross_amount}`);
      
      // DI SINILAH SEHARUSNYA ANDA MENULIS KE DATABASE (PostgreSQL / GORM / Prisma)
      // Misalnya: UPDATE transactions SET status = 'sukses' WHERE id = order_id
      // UPDATE cafes SET balance = balance + netCafe WHERE ...

    } else if (transaction_status === 'pending') {
      console.log(`⏳ [WEBHOOK] Menunggu pembayaran. Order ID: ${order_id}`);
    } else {
      console.log(`❌ [WEBHOOK] Status transaksi: ${transaction_status}. Order ID: ${order_id}`);
    }

    // Selalu kembalikan status 200 OK ke Midtrans agar mereka tidak melakukan pengiriman ulang (retry)
    return NextResponse.json({ message: 'Webhook received' }, { status: 200 });

  } catch (error: any) {
    console.error('Error handling webhook:', error.message);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}