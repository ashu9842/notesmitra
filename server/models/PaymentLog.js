import mongoose from 'mongoose';

const paymentLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true
  },
  source: {
    type: String,
    enum: ['webhook', 'purchase', 'refund'],
    required: true
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase'
  },
  noteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note'
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paymentMethod: String,
  razorpayPaymentId: String,
  statusFrom: String,
  statusTo: String,
  ip: String,
  userAgent: String,
  payload: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

const preventDeletion = function (next) {
  next(new Error('Payment logs cannot be deleted'));
};

paymentLogSchema.pre('deleteOne', { document: false, query: true }, preventDeletion);
paymentLogSchema.pre('deleteMany', { document: false, query: true }, preventDeletion);
paymentLogSchema.pre('findOneAndDelete', preventDeletion);
paymentLogSchema.pre('findOneAndRemove', preventDeletion);
paymentLogSchema.pre('findByIdAndDelete', preventDeletion);

const PaymentLog = mongoose.model('PaymentLog', paymentLogSchema);

export default PaymentLog;
