import { Pool } from 'pg';
import { migrate } from '../src/server/migrations.js';
if(!process.env.ADMIN_DATABASE_URL)throw new Error('ADMIN_DATABASE_URL is required for migrations');
const pool=new Pool({connectionString:process.env.ADMIN_DATABASE_URL});
try{await migrate(pool);console.log('Workspace schema is current');}finally{await pool.end();}
