// One-time migration script to ensure users.mobile is sparse unique and no documents store mobile: null
// Usage: node scripts/fixMobileIndex.js

require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/StarForge';

(async () => {
  try {
    console.log('[Migration] Connecting to MongoDB:', uri);
    await mongoose.connect(uri, { autoIndex: false });
    const db = mongoose.connection.db;

    // 1) Unset mobile where null OR empty string
    const unsetNull = await db.collection('users').updateMany({ mobile: null }, { $unset: { mobile: '' } });
    const unsetEmpty = await db.collection('users').updateMany({ mobile: '' }, { $unset: { mobile: '' } });
    console.log(`[Migration] Unset null mobile fields: matched=${unsetNull.matchedCount}, modified=${unsetNull.modifiedCount}`);
    console.log(`[Migration] Unset empty-string mobile fields: matched=${unsetEmpty.matchedCount}, modified=${unsetEmpty.modifiedCount}`);

    // 2) Check existing indexes
    const indexes = await db.collection('users').indexes();
    const mobileIndexes = indexes.filter(ix => ix.key && ix.key.mobile === 1);
    console.log('[Migration] Existing indexes:', indexes.map(ix => ({ name: ix.name, key: ix.key, unique: !!ix.unique, sparse: !!ix.sparse })));

    // 3) Drop any existing indexes on {mobile:1} to avoid conflicts
    for (const ix of mobileIndexes) {
      console.log(`[Migration] Dropping existing index on mobile: name=${ix.name}, unique=${!!ix.unique}, sparse=${!!ix.sparse}`);
      try {
        await db.collection('users').dropIndex(ix.name);
      } catch (e) {
        console.warn(`[Migration] Failed to drop index ${ix.name}:`, e.message);
      }
    }

    // 4) Ensure sparse unique index exists
    // 4) Create the desired sparse unique index (compatible with your MongoDB version)
    console.log('[Migration] Creating sparse unique index on users.mobile');
    await db.collection('users').createIndex(
      { mobile: 1 },
      { unique: true, sparse: true, name: 'mobile_1' }
    );

    const finalIndexes = await db.collection('users').indexes();
    const check = finalIndexes.find(ix => ix.name === 'mobile_1');
    console.log('[Migration] Final mobile_1 index:', { name: check?.name, key: check?.key, unique: !!check?.unique, sparse: !!check?.sparse });

    console.log('[Migration] Done.');
  } catch (err) {
    console.error('[Migration] Error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
