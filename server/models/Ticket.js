import mongoose from 'mongoose';
import tenantPlugin from '../utils/tenantPlugin.js';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  senderRole: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const ticketSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  guestName: {
    type: String,
    trim: true,
    default: null
  },
  guestEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  category: {
    type: String,
    enum: ['technical', 'payment', 'content', 'other'],
    required: true
  },
  subject: {
    type: String,
    required: [true, 'Please provide a subject'],
    trim: true,
    minlength: [5, 'Subject must be at least 5 characters'],
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  relatedNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
ticketSchema.index({ userId: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ createdAt: -1 });

// Apply tenant plugin
ticketSchema.plugin(tenantPlugin);

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
