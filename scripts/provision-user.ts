import { Pool } from 'pg';
import { provisionUser } from '../src/server/store.js';
const url=process.env.ADMIN_DATABASE_URL,email=process.env.TERMINAL_ACCOUNT_EMAIL,password=process.env.TERMINAL_ACCOUNT_PASSWORD;
if(!url||!email||!password)throw new Error('Set admin database and account email/password in the process environment');
const pool=new Pool({connectionString:url});
try{const user=await provisionUser(pool,email,password);console.log('Provisioned account '+user.id);}
finally{await pool.end();}
