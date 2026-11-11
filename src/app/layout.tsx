import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title:'R. & D. Maison | Beauty for Every Shade',
  description:'Thoughtful beauty essentials from R. & D. Maison. Discover complexion, colour and everyday skincare.',
  openGraph:{title:'R. & D. Maison',description:'Beauty for Every Shade',type:'website'}
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
