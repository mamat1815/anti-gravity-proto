// app/api/payout/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { cafeId, bankName, bankAccount } = body;

    if (!cafeId) {
      return NextResponse.json({ error: 'ID Kafe harus diisi' }, { status: 400 });
    }

    const db = adminDb;
    if (db) {
      const cafeRef = db.collection('cafes').doc(cafeId);
      const cafeSnap = await cafeRef.get();

      if (!cafeSnap.exists) {
        return NextResponse.json({ error: 'Kafe tidak ditemukan' }, { status: 404 });
      }

      const cafeData = cafeSnap.data();
      const amountToTransfer = (cafeData && cafeData.balance) || 0;

      if (amountToTransfer <= 0) {
        return NextResponse.json({ error: 'Tidak ada saldo tertunda untuk dicairkan' }, { status: 400 });
      }

      // Gunakan Transaction Firestore agar atomik dan aman
      await db.runTransaction(async (transaction) => {
        // 1. Dapatkan data kafe terupdate
        const freshCafeSnap = await transaction.get(cafeRef);
        const freshCafeData = freshCafeSnap.data();
        const balance = (freshCafeData && freshCafeData.balance) || 0;
        const transferredBalance = (freshCafeData && freshCafeData.transferredBalance) || 0;

        // 2. Buat Log Payout
        const payoutRef = db.collection('payouts').doc();
        transaction.set(payoutRef, {
          cafeId,
          cafeName: freshCafeData?.name || 'Kafe',
          amount: balance,
          status: 'success',
          timestamp: new Date().toISOString(),
          bankName: bankName || 'Bank Mandiri',
          bankAccount: bankAccount || '1234567890'
        });

        // 3. Update Saldo Kafe (set ke 0, tambahkan ke transferredBalance)
        transaction.update(cafeRef, {
          balance: 0,
          transferredBalance: transferredBalance + balance
        });
      });

      // 4. Update status payout pada reservasi terkait (di luar transaksi agar tidak memblokir)
      const reservationsSnap = await db.collection('reservations')
        .where('cafeId', '==', cafeId)
        .where('status', '==', 'settlement')
        .where('payoutStatus', '==', 'pending')
        .get();

      if (!reservationsSnap.empty) {
        const batch = db.batch();
        reservationsSnap.forEach((doc) => {
          batch.update(doc.ref, {
            payoutStatus: 'transferred',
            payoutTimestamp: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      return NextResponse.json({ message: 'Payout berhasil diproses', amount: amountToTransfer });
    } else {
      // Mock Mode - Frontend yang akan mengupdate LocalStorage melalui dbService
      return NextResponse.json({ 
        message: 'Mock Mode: Mohon proses payout langsung di sisi Client (dbService)',
        isMock: true 
      });
    }

  } catch (error: any) {
    console.error('Error processing payout API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
