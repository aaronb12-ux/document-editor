import pg from 'pg';
import 'dotenv/config';

const url = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL;

export const pool = new pg.Pool({
  connectionString: url,
  ssl: url?.includes('localhost') ? false : { rejectUnauthorized: false },
});

export const query = (text, params) => pool.query(text, params);