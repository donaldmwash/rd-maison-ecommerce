import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){
 try{
  const db=createAdminClient();
  const {data,error}=await db.from('products').select('id,name,category,description,price_kes,size,accent').eq('active',true).order('name');
  if(error)throw error;
  return NextResponse.json({products:data||[]},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Catalogue fetch failed',e);return NextResponse.json({error:'Live catalogue is temporarily unavailable.'},{status:503});}
}
