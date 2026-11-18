import { redirect } from 'next/navigation';
import { viewer } from '../../src/server/session';
import { database } from '../../src/server/store';
import { workbenchSnapshot } from '../../src/core/store';
import Workbench from './Workbench';
export const dynamic='force-dynamic';
export default async function Page(){
 const account=await viewer();if(!account)redirect('/login');
 return <Workbench initial={JSON.parse(JSON.stringify(await workbenchSnapshot(database(),account.id)))} account={account}/>;
}
