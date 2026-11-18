import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Mochex Terminal',description:'Your private market analysis workspace'};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
