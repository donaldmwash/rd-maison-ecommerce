import { NextRequest,NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 const secret=process.env.MPESA_CALLBACK_SECRET;
 if(!secret||req.nextUrl.searchParams.get('token')!==secret)return NextResponse.json({ResultCode:1,ResultDesc:'Unauthorized callback'},{status:401});
 const body=await req.json().catch(()=>null),cb=body?.Body?.stkCallback;
 if(!cb?.CheckoutRequestID||typeof cb.ResultCode!=='number')return NextResponse.json({ResultCode:1,ResultDesc:'Invalid callback'},{status:400});
 try{
  const db=createAdminClient(),{data:p}=await db.from('payments').select('id,order_id,amount_kes,status').eq('checkout_request_id',cb.CheckoutRequestID).single();
  if(!p)return NextResponse.json({ResultCode:0,ResultDesc:'Callback received'});
  const items=cb.CallbackMetadata?.Item||[],get=(n:string)=>items.find((x:{Name:string;Value?:unknown})=>x.Name===n)?.Value;
  const amount=Number(get('Amount')),receipt=String(get('MpesaReceiptNumber')||'');
  const paid=cb.ResultCode===0&&amount===p.amount_kes&&/^[A-Z0-9]{8,16}$/.test(receipt);
  const status=paid?'paid':cb.ResultCode===1032?'cancelled':'failed';
  await db.from('payments').update({status,result_code:String(cb.ResultCode),result_description:String(cb.ResultDesc||''),mpesa_receipt_number:paid?receipt:null,raw_callback:body,updated_at:new Date().toISOString()}).eq('id',p.id);
  if(paid&&p.status!=='paid')await db.from('orders').update({payment_status:'paid',status:'processing',updated_at:new Date().toISOString()}).eq('id',p.order_id);
  else if(!paid&&p.status==='initiated')await db.from('orders').update({payment_status:status,updated_at:new Date().toISOString()}).eq('id',p.order_id);
  return NextResponse.json({ResultCode:0,ResultDesc:'Callback processed'});
 }catch(e){console.error('Daraja callback error',e);return NextResponse.json({ResultCode:1,ResultDesc:'Callback processing failed'},{status:500});}
}
