import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paginate} from '../src/core/pagination.js';

test('UX-01: EXMOCHEX style paging clamps after filters and supports all rows',()=>{
 const rows=Array.from({length:43},(_,i)=>i);
 assert.deepEqual(paginate(rows,1,20),{items:rows.slice(20,40),page:1,pageCount:3,total:43});
 assert.deepEqual(paginate(rows.slice(0,3),2,20),{items:[0,1,2],page:0,pageCount:1,total:3});
 assert.deepEqual(paginate(rows,1,'all'),{items:rows,page:0,pageCount:1,total:43});
});
