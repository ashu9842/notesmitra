import mongoose from 'mongoose';
import tenantPlugin from '../utils/tenantPlugin.js';

const noteSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: [true, 'Tenant ID is required'],
    index: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a title'],
    trim: true,
    minlength: [5, 'Title is too short (minimum 5 characters)'],
    maxlength: [200, 'Title is too long (maximum 200 characters)']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    minlength: [20, 'Description is too short (minimum 20 characters)'],
    maxlength: [2000, 'Description is too long (maximum 2000 characters)']
  },
  subject: {
    type: String,
    required: [true, 'Please provide a subject'],
    trim: true
  },
  semester: {
    type: String,
    required: [true, 'Please provide a semester'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Please provide a price'],
    min: [20, 'Price too low (minimum ₹20)'],
    max: [50, 'Price too high (maximum ₹50)']
  },
  pages: {
    type: Number,
    required: [true, 'Please provide page count'],
    min: [3, 'Minimum 3 pages required']
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: false  // Optional: used only for local storage
  },
  // Cloudinary storage fields
  cloudinaryUrl: {
    type: String,
    required: false  // Required when using Cloudinary
  },
  cloudinaryPublicId: {
    type: String,
    required: false  // Used to delete files from Cloudinary
  },
  storageType: {
    type: String,
    enum: ['local', 'cloudinary'],
    default: 'local'
  },
  status: {
    type: String,
    enum: ['pending_review', 'approved', 'rejected', 'failed_quality_check'],
    default: 'pending_review'
  },
  // Premium features
  isPriorityApproval: {
    type: Boolean,
    default: false,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },
  sellerSubscriptionType: {
    type: String,
    enum: ['free_seller', 'premium_seller', 'combo'],
    default: 'free_seller'
  },
  qualityChecks: {
    pageCount: { type: Boolean, default: false },
    fileSize: { type: Boolean, default: false },
    fileType: { type: Boolean, default: false },
    hasTitle: { type: Boolean, default: false },
    hasDescription: { type: Boolean, default: false },
    copyrightCheck: { type: Boolean, default: true },
    blankPageCheck: { type: Boolean, default: true },
    qualityCheck: { type: Boolean, default: true },
    metadataCheck: { type: Boolean, default: true },
    duplicateCheck: { type: Boolean, default: true }
  },
  rejectionReason: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNotes: {
    type: String
  },
  downloads: {
    type: Number,
    default: 0
  },
  downloadedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
noteSchema.index({ sellerId: 1 });
noteSchema.index({ status: 1 });
noteSchema.index({ subject: 1 });
noteSchema.index({ semester: 1 });
noteSchema.index({ title: 'text', description: 'text' });
noteSchema.index({ createdAt: -1 });

// Apply tenant plugin
noteSchema.plugin(tenantPlugin);

const Note = mongoose.model('Note', noteSchema);

export default Note;
