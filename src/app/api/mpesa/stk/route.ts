import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const schema=z.object({orderId:z.string().uuid()});
function nairobiTimestamp(){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Nairobi',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 return get('year')+get('month')+get('day')+get('hour')+get('minute')+get('second');
}
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
 if(!code||!pass||!callback||!process.env.MPESA_CONSUMER_KEY||!process.env.MPESA_CONSUMER_SECRET)return NextResponse.json({error:'M-Pesa is not configured yet. Your order has been saved but has not been charged.'},{status:503});
 try{
  const db=createAdminClient(),{data:o,error}=await db.from('orders').select('id,order_number,total_kes,payment_status,phone').eq('id',v.data.orderId).single();
  if(error||!o)return NextResponse.json({error:'Order not found.'},{status:404});
  if(o.payment_status==='paid')return NextResponse.json({error:'This order is already paid.'},{status:409});
  if(o.payment_status==='initiated')return NextResponse.json({error:'A payment request has already been started. Check the customer phone before retrying.'},{status:409});
  if(!Number.isInteger(o.total_kes)||o.total_kes<1)return NextResponse.json({error:'The order amount is invalid.'},{status:400});
  const access=await token();
  const {data:attempt,error:attemptError}=await db.from('payments').insert({order_id:o.id,phone:o.phone,amount_kes:o.total_kes,status:'initiated'}).select('id').single();
  if(attemptError)throw attemptError;
  const stamp=nairobiTimestamp(),pwd=Buffer.from(code+pass+stamp).toString('base64');
  const host=process.env.MPESA_ENVIRONMENT==='production'?'https://api.safaricom.co.ke':'https://sandbox.safaricom.co.ke';
  const r=await fetch(host+'/mpesa/stkpush/v1/processrequest',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({BusinessShortCode:code,Password:pwd,Timestamp:stamp,TransactionType:process.env.MPESA_TRANSACTION_TYPE||'CustomerPayBillOnline',Amount:Math.max(1,Math.round(o.total_kes)),PartyA:o.phone,PartyB:code,PhoneNumber:o.phone,CallBackURL:callback,AccountReference:'RDMAISON-'+o.order_number,TransactionDesc:'R&D Maison order '+o.order_number})});
  const data=await r.json();
  if(!r.ok||data.ResponseCode!=='0'){
   await db.from('payments').update({status:'failed',result_description:String(data.errorMessage||data.ResponseDescription||'Safaricom rejected the STK request.')}).eq('id',attempt.id);
   return NextResponse.json({error:data.errorMessage||data.ResponseDescription||'Safaricom could not start payment. Your order remains unpaid.'},{status:502});
  }
  const {error:saveError}=await db.from('payments').update({merchant_request_id:data.MerchantRequestID,checkout_request_id:data.CheckoutRequestID}).eq('id',attempt.id);
  if(saveError)throw saveError;
  const {error:orderError}=await db.from('orders').update({payment_status:'initiated'}).eq('id',o.id);
  if(orderError)throw orderError;
  return NextResponse.json({message:'Payment prompt sent. Check your phone and enter your M-Pesa PIN.'});
 }catch(e){console.error('STK push error',e);return NextResponse.json({error:'Could not start M-Pesa payment. No payment has been confirmed.'},{status:502});}
}
