const { createMysqlConnection } = require('./database');

/**
 * Run database migrations / initialization on startup
 * Safe to run multiple times (idempotent)
 */
async function initializeDatabase() {
  let connection;
  try {
    connection = await createMysqlConnection();
    console.log('\n' + '='.repeat(60));
    console.log('🔧 [DATABASE] Running initialization checks...');
    console.log('='.repeat(60));

    // Migration 1: Add MANUAL_OPEN to status enum if not exists
    try {
      console.log('\n📝 [MIGRATION 1] Checking status enum values...');
      const [columnInfo] = await connection.execute(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_NAME='access_logs' AND COLUMN_NAME='status' 
         AND TABLE_SCHEMA=DATABASE()`
      );

      if (columnInfo.length > 0) {
        const columnType = columnInfo[0].COLUMN_TYPE;
        console.log(`   Current status enum: ${columnType}`);

        if (!columnType.includes('MANUAL_OPEN')) {
          console.log('   ⚠️  MANUAL_OPEN missing from enum, adding...');
          await connection.execute(
            `ALTER TABLE access_logs MODIFY COLUMN status ENUM('VALID','INVALID','MANUAL_OPEN') DEFAULT 'INVALID'`
          );
          console.log('   ✅ MANUAL_OPEN enum value added successfully');
        } else {
          console.log('   ✅ MANUAL_OPEN already exists, skipping');
        }
      }
    } catch (migrationError) {
      console.error('   ⚠️  Migration 1 warning:', migrationError.message);
      // Non-blocking - continue with startup
    }

    console.log('\n✅ Database initialization complete!');
    console.log('='.repeat(60) + '\n');
    return true;
  } catch (error) {
    console.error('\n❌ FATAL: Database initialization failed:', error.message);
    console.error('Please ensure:');
    console.error('  1. MySQL server is running');
    console.error('  2. Database smart_gate_db_new exists');
    console.error('  3. DB_HOST, DB_USER, DB_PASSWORD are correct in .env');
    console.error('='.repeat(60) + '\n');
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

module.exports = { initializeDatabase };
