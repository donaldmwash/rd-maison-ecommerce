import { NextResponse } from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({status:'ok',service:'rd-maison-ecommerce',databaseConfigured:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),paymentsConfigured:Boolean(process.env.MPESA_CONSUMER_KEY&&process.env.MPESA_CONSUMER_SECRET&&process.env.MPESA_SHORTCODE&&process.env.MPESA_PASSKEY&&process.env.MPESA_CALLBACK_URL)},{headers:{'Cache-Control':'no-store'}});}
