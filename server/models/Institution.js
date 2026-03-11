import mongoose from "mongoose";

const institutionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Institution name is required"],
      trim: true,
      minlength: [2, "Institution name must be at least 2 characters"],
      maxlength: [100, "Institution name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    plan: {
      type: String,
      enum: {
        values: ["free", "pro", "enterprise"],
        message: "Plan must be one of: free, pro, enterprise",
      },
      default: "free",
    },
    maxUsers: {
      type: Number,
      required: [true, "Maximum users limit is required"],
      min: [1, "Maximum users must be at least 1"],
      default: 10,
    },
    storageLimit: {
      type: Number,
      required: [true, "Storage limit is required"],
      min: [1, "Storage limit must be at least 1 GB"],
      default: 10, // in GB
    },
    maxUploads: {
      type: Number,
      required: [true, "Maximum uploads limit is required"],
      min: [1, "Maximum uploads must be at least 1"],
      default: 50,
    },
    usedStorage: {
      type: Number,
      default: 0, // in GB
      min: [0, "Used storage cannot be negative"]
    },
    currentUploads: {
      type: Number,
      default: 0,
      min: [0, "Current uploads cannot be negative"]
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      sparse: true,
      index: true
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'trial', 'free'],
      default: 'free',
      index: true
    },
    subscriptionExpiry: {
      type: Date,
      sparse: true,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create text index for search
institutionSchema.index({ name: "text", slug: "text" });

export default mongoose.model("Institution", institutionSchema);
