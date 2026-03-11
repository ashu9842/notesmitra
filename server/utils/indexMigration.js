/**
 * MongoDB Index Migration
 * Drops problematic indices that cause duplicate key errors
 */
export async function runIndexMigrations(mongooseConnection) {
  try {
    const db = mongooseConnection.getClient().db('notesmitra');
    
    // Drop the bad transactions.id index
    try {
      await db.collection('wallets').dropIndex('transactions.id_1');
      console.log('✅ Dropped bad transactions.id_1 index');
    } catch (e) {
      if (e.code !== 27) { // 27 = index not found
        console.log('⚠️ transactions.id_1 index: already gone or error -', e.message.split('\n')[0]);
      }
    }

    // Also try dropping any sparse index on transactions
    try {
      await db.collection('wallets').dropIndex('transactions.id_1');
    } catch (e) {
      // Ignore if doesn't exist
    }

  } catch (error) {
    console.error('Index migration error:', error.message);
  }
}
