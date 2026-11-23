export function paginate<T>(rows:T[],requestedPage:number,pageSize:number|'all'){
 const total=rows.length;
 if(pageSize==='all')return {items:rows,page:0,pageCount:1,total};
 if(!Number.isSafeInteger(pageSize)||pageSize<1)throw Error('Invalid page size');
 const pageCount=Math.max(1,Math.ceil(total/pageSize));
 const page=Math.max(0,Math.min(Number.isSafeInteger(requestedPage)?requestedPage:0,pageCount-1));
 return {items:rows.slice(page*pageSize,(page+1)*pageSize),page,pageCount,total};
}
