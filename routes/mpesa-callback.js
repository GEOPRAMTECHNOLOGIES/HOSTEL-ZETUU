const express = require('express');
const { Payment } = require('../models/misc');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const Student = require('../models/Student');
const { sendBookingConfirmationEmail, sendPaymentReceiptEmail } = require('../utils/email');
const Transaction = require('../models/Transaction');
const Lease = require('../models/Lease');

const router = express.Router();

/**
 * Safaricom POSTs here after the customer accepts/cancels/times out the STK push.
 * This endpoint must always respond 200 with ResultCode 0, regardless of outcome,
 * or Safaricom will retry repeatedly.
 */
router.post('/callback', async (req, res) => {
  // Always acknowledge receipt immediately
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) return;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const payment = await Payment.findOne({ checkoutRequestId: CheckoutRequestID });
    if (!payment) {
      console.warn('[MPESA] Callback for unknown checkoutRequestId:', CheckoutRequestID);
      return;
    }

    const alreadyProcessed = payment.status === 'success';
    if (alreadyProcessed) return;

    payment.rawCallback = req.body;
    payment.resultCode = String(ResultCode);
    payment.resultDesc = ResultDesc;

    if (Number(ResultCode) === 0) {
      // Success — extract metadata items
      const items = CallbackMetadata?.Item || [];
      const get = (name) => items.find((i) => i.Name === name)?.Value;

      payment.status = 'success';
      payment.mpesaReceiptNumber = get('MpesaReceiptNumber');
      payment.transactionDate = String(get('TransactionDate') || '');
      await payment.save();

      const booking = await Booking.findById(payment.booking).populate('hostel').populate('room');
      if (booking) {
        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        booking.confirmedAt = new Date();
        await booking.save();

        await Room.findByIdAndUpdate(booking.room._id, { status: 'booked' });
        await Hostel.findByIdAndUpdate(booking.hostel._id, { $inc: { availableRooms: -1 } });
        await Student.findByIdAndUpdate(booking.student, { $inc: { bookingsCount: 1 } });

        let transaction = await Transaction.findOne({ payment: payment._id });
        const isNewTransaction = !transaction;
        if (!transaction) {
          transaction = await Transaction.create({
            student: booking.student,
            hostel: booking.hostel._id,
            room: booking.room._id,
            booking: booking._id,
            payment: payment._id,
            type: 'booking_fee',
            direction: 'credit',
            amount: payment.amount,
            method: 'mpesa',
            status: 'completed',
            mpesaReceiptNumber: payment.mpesaReceiptNumber,
            description: `Booking fee for ${booking.bookingRef}`,
          });
        }

        await Lease.findOneAndUpdate(
          { booking: booking._id },
          {
            $setOnInsert: {
              student: booking.student,
              hostel: booking.hostel._id,
              room: booking.room._id,
              booking: booking._id,
              startDate: booking.moveInDate,
              monthlyRent: booking.roomPriceSnapshot,
              deposit: booking.room?.deposit || 0,
              status: 'active',
            }
          },
          { upsert: true }
        );

        if (isNewTransaction) sendPaymentReceiptEmail(booking.studentSnapshot.email, {
          receipt: payment.mpesaReceiptNumber,
          transactionRef: transaction.transactionRef,
          bookingRef: booking.bookingRef,
          studentName: booking.studentSnapshot.name,
          email: booking.studentSnapshot.email,
          hostelName: booking.hostel.name,
          roomTitle: booking.room.title,
          amount: payment.amount,
          method: 'M-Pesa',
          date: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
        }).catch((e) => console.error('[EMAIL] payment receipt failed:', e.message));

        sendBookingConfirmationEmail(booking.studentSnapshot.email, {
          bookingRef: booking.bookingRef,
          hostelName: booking.hostel.name,
          roomTitle: booking.room.title,
          moveInDate: booking.moveInDate,
          bookingFee: booking.bookingFee,
          mpesaReceipt: payment.mpesaReceiptNumber,
        }).catch((e) => console.error('[EMAIL] confirmation failed:', e.message));
      }
    } else {
      // Failed, cancelled, or timed out
      payment.status = Number(ResultCode) === 1032 ? 'cancelled' : 'failed';
      await payment.save();

      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.status = 'cancelled';
        booking.paymentStatus = 'failed';
        booking.cancelReason = ResultDesc;
        await booking.save();

        // Release the room back to availability
        await Room.findByIdAndUpdate(booking.room, { status: 'available' });
      }
    }
  } catch (err) {
    console.error('[MPESA] Callback processing error:', err.message);
  }
});

module.exports = router;
