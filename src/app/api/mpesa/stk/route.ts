import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime='nodejs';
const schema=z.object({orderId:z.string().uuid(),phone:z.string().min(9).max(16)});
const phone=(v:string)=>{const n=v.replace(/\\D/g,'');return n.startsWith('254')?n:n.startsWith('0')?'254'+n:'254'+n;};
async function token(){
 const key=process.env.MPESA_CONSUMER_KEY,secret=process.env.MPESA_CONSUMER_SECRET;
 if(!key||!secret)throw new Error('Daraja credentials are missing.');
 const host=process.env.MPESA_ENVIRONMENT==='production'?'https://api.safaricom.co.ke':'https://sandbox.safaricom.co.ke';
 const r=await fetch(host+'/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64')},cache:'no-store'});
 if(!r.ok)throw new Error('Daraja authentication failed.');
 return (await r.json()).access_token as string;
}
export async function POST(req:NextRequest){
 const v=schema.safeParse(await req.json().catch(()=>null));
 if(!v.success)return NextResponse.json({error:'Invalid payment request.'},{status:400});
 const {MPESA_SHORTCODE:code,MPESA_PASSKEY:pass,MPESA_CALLBACK_URL:callback}=process.env;
 if(!code||!pass||!callback||!process.env.MPESA_CONSUMER_KEY||!process.env.MPESA_CONSUMER_SECRET)return NextResponse.json({error:'M-Pesa is not configured yet. Your order has not been charged.'},{status:503});
 try{
  const db=createAdminClient(),{data:o,error}=await db.from('orders').select('id,order_number,total_kes,payment_status').eq('id',v.data.orderId).single();
  if(error||!o)return NextResponse.json({error:'Order not found.'},{status:404});
  if(o.payment_status==='paid')return NextResponse.json({error:'This order is already paid.'},{status:409});
  const stamp=new Date().toISOString().replace(/\\D/g,'').slice(0,14),pwd=Buffer.from(code+pass+stamp).toString('base64');
  const host=process.env.MPESA_ENVIRONMENT==='production'?'https://api.safaricom.co.ke':'https://sandbox.safaricom.co.ke';
  const r=await fetch(host+'/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({BusinessShortCode:code,Password:pwd,Timestamp:stamp,TransactionType:process.env.MPESA_TRANSACTION_TYPE||'CustomerPayBillOnline',Amount:Math.max(1,Math.round(o.total_kes)),PartyA:phone(v.data.phone),PartyB:code,PhoneNumber:phone(v.data.phone),CallBackURL:callback,AccountReference:'RDMAISON-'+o.order_number,TransactionDesc:'R&D Maison order '+o.order_number})});
  const data=await r.json();if(!r.ok||data.ResponseCode!=='0')return NextResponse.json({error:data.errorMessage||data.ResponseDescription||'Safaricom could not start payment.'},{status:502});
  const {error:pe}=await db.from('payments').insert({order_id:o.id,merchant_request_id:data.MerchantRequestID,checkout_request_id:data.CheckoutRequestID,phone:phone(v.data.phone),amount_kes:o.total_kes,status:'initiated'});
  if(pe)throw pe;
  await db.from('orders').update({payment_status:'initiated'}).eq('id',o.id);
  return NextResponse.json({message:'Payment prompt sent. Check your phone and enter your M-Pesa PIN.'});
 }catch(e){console.error('STK push error',e);return NextResponse.json({error:'Could not start M-Pesa payment. No payment has been confirmed.'},{status:502});}
}
