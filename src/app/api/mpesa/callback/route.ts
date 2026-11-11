import { NextRequest,NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const secureMatch=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export async function POST(req:NextRequest){
 const secret=process.env.MPESA_CALLBACK_SECRET,supplied=req.nextUrl.searchParams.get('token')||'';
 if(!secret||!supplied||!secureMatch(secret,supplied))return NextResponse.json({ResultCode:1,ResultDesc:'Unauthorized callback'},{status:401});
 const body=await req.json().catch(()=>null),cb=body?.Body?.stkCallback;
 if(!cb?.CheckoutRequestID||typeof cb.ResultCode!=='number')return NextResponse.json({ResultCode:1,ResultDesc:'Invalid callback'},{status:400});
 try{
  const db=createAdminClient(),{data:p,error:lookupError}=await db.from('payments').select('id,order_id,amount_kes,phone,status').eq('checkout_request_id',cb.CheckoutRequestID).single();
  if(lookupError||!p)return NextResponse.json({ResultCode:0,ResultDesc:'Callback acknowledged'});
  if(p.status==='paid')return NextResponse.json({ResultCode:0,ResultDesc:'Payment already processed'});
  const items=cb.CallbackMetadata?.Item||[],get=(n:string)=>items.find((x:{Name:string;Value?:unknown})=>x.Name===n)?.Value;
  const amount=Number(get('Amount')),receipt=String(get('MpesaReceiptNumber')||''),paidPhone=String(get('PhoneNumber')||'').replace(/\D/g,'');
  const paid=cb.ResultCode===0&&amount===p.amount_kes&&/^[A-Z0-9]{8,16}$/.test(receipt)&&(!paidPhone||paidPhone===p.phone);
  const status=paid?'paid':cb.ResultCode===1032?'cancelled':'failed';
  const {error:paymentError}=await db.from('payments').update({status,result_code:String(cb.ResultCode),result_description:String(cb.ResultDesc||''),mpesa_receipt_number:paid?receipt:null,raw_callback:body,updated_at:new Date().toISOString()}).eq('id',p.id);
  if(paymentError)throw paymentError;
  const {error:orderError}=await db.from('orders').update(paid?{payment_status:'paid',status:'processing',updated_at:new Date().toISOString()}:{payment_status:status,updated_at:new Date().toISOString()}).eq('id',p.order_id);
  if(orderError)throw orderError;
  return NextResponse.json({ResultCode:0,ResultDesc:'Callback processed'});
 }catch(e){console.error('Daraja callback error',e);return NextResponse.json({ResultCode:1,ResultDesc:'Callback processing failed'},{status:500});}
}
