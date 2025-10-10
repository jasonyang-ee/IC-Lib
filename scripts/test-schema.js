import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: 'infra.main.local',
  port: 5435,
  user: 'sami',
  password: '123456',
  database: 'cip'
});

async function test() {
  try {
    console.log('Checking component_categories table structure...');
    const structureResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'component_categories'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', JSON.stringify(structureResult.rows, null, 2));
    
    console.log('\nTesting component_categories table...');
    const result = await pool.query(`
      SELECT * 
      FROM component_categories 
      LIMIT 3
    `);
    console.log('Categories:', JSON.stringify(result.rows, null, 2));
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
    process.exit(1);
  }
}

test();
