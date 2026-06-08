// app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';

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
      
      // Update data di Firestore jika Firebase Admin terkonfigurasi
      if (adminDb) {
        const reservationRef = adminDb.collection('reservations').doc(order_id);
        const reservationSnap = await reservationRef.get();

        if (reservationSnap.exists) {
          const reservationData = reservationSnap.data();
          if (reservationData && reservationData.status !== 'settlement') {
            // Update status reservasi
            await reservationRef.update({ status: 'settlement' });

            // Tambahkan saldo ke kafe terkait
            const cafeId = reservationData.cafeId;
            const cafeRef = adminDb.collection('cafes').doc(cafeId);
            const cafeSnap = await cafeRef.get();

            if (cafeSnap.exists) {
              const cafeData = cafeSnap.data();
              const currentBalance = (cafeData && cafeData.balance) || 0;
              await cafeRef.update({
                balance: currentBalance + reservationData.itemPrice
              });
              console.log(`✅ [WEBHOOK] Saldo Kafe ${cafeId} bertambah Rp ${reservationData.itemPrice}`);
            } else {
              console.error(`🚨 [WEBHOOK] Gagal menambah saldo: Kafe dengan ID ${cafeId} tidak ditemukan.`);
            }
          }
        } else {
          console.error(`🚨 [WEBHOOK] Transaksi dengan Order ID ${order_id} tidak ditemukan di Firestore.`);
        }
      }

    } else if (transaction_status === 'pending') {
      console.log(`⏳ [WEBHOOK] Menunggu pembayaran. Order ID: ${order_id}`);
    } else {
      console.log(`❌ [WEBHOOK] Status transaksi: ${transaction_status}. Order ID: ${order_id}`);
    }

    // Selalu kembalikan status 200 OK ke Midtrans
    return NextResponse.json({ message: 'Webhook received' }, { status: 200 });

  } catch (error: any) {
    console.error('Error handling webhook:', error.message);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}