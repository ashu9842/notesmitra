/**
 * Migration: Fix download counts
 * Recalculates note.downloads as the number of unique buyers (completed purchases)
 * and populates note.downloadedBy with those buyer IDs.
 *
 * Usage: node scripts/fix-download-counts.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Note from '../models/Note.js';
import Purchase from '../models/Purchase.js';
import config from '../config/index.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(config.mongoUri);
  console.log('✅ MongoDB connected');

  const notes = await Note.find({}).select('_id title downloads downloadedBy').lean();
  console.log(`Found ${notes.length} notes to process`);

  let updated = 0;

  for (const note of notes) {
    // Get all unique buyers who completed a purchase for this note
    const purchases = await Purchase.find({
      noteId: note._id,
      status: 'completed'
    }).select('buyerId').lean();

    const uniqueBuyerIds = [...new Map(
      purchases.map(p => [p.buyerId.toString(), p.buyerId])
    ).values()];

    await Note.updateOne(
      { _id: note._id },
      {
        $set: {
          downloads: uniqueBuyerIds.length,
          downloadedBy: uniqueBuyerIds
        }
      }
    );

    console.log(`  "${note.title}": ${note.downloads} → ${uniqueBuyerIds.length} unique downloads`);
    updated++;
  }

  console.log(`\n✅ Done. Updated ${updated} notes.`);
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
