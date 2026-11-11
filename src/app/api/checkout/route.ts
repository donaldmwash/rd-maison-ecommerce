import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
export const runtime='nodejs';
const schema=z.object({
 customerName:z.string().trim().min(2).max(100),
 phone:z.string().trim().regex(/^(?:\\+?254|0)?[17]\\d{8}$/),
 email:z.string().trim().email().max(254).optional().or(z.literal('')),
 town:z.string().trim().min(2).max(100),address:z.string().trim().max(300).optional().default(''),
 items:z.array(z.object({productId:z.string().uuid(),quantity:z.number().int().min(1).max(20),shade:z.string().max(60).optional().default('')})).min(1).max(30)
});
const normalize=(v:string)=>{const n=v.replace(/\\D/g,'');return n.startsWith('254')?n:n.startsWith('0')?'254'+n:'254'+n;};
export async function POST(req:NextRequest){
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'Please check your checkout details.'},{status:400});
 try{
  const db=createAdminClient(),ids=[...new Set(parsed.data.items.map(x=>x.productId))];
  const {data:products,error}=await db.from('products').select('id,name,price_kes,active').in('id',ids);
  if(error)throw error;
  if(!products||products.length!==ids.length||products.some(p=>!p.active))return NextResponse.json({error:'A product is unavailable. Refresh your bag and try again.'},{status:409});
  const rows=parsed.data.items.map(i=>{const p=products.find(x=>x.id===i.productId)!;return{product_id:p.id,product_name:p.name,variant_name:i.shade||'',unit_price_kes:p.price_kes,quantity:i.quantity,line_total_kes:p.price_kes*i.quantity};});
  const subtotal=rows.reduce((s,x)=>s+x.line_total_kes,0);
  const {data:order,error:oe}=await db.from('orders').insert({customer_name:parsed.data.customerName,phone:normalize(parsed.data.phone),email:parsed.data.email||null,delivery_town:parsed.data.town,delivery_address:parsed.data.address||'',subtotal_kes:subtotal,delivery_fee_kes:0,total_kes:subtotal,payment_method:'mpesa'}).select('id,order_number,total_kes').single();
  if(oe)throw oe;
  const {error:ie}=await db.from('order_items').insert(rows.map(x=>({...x,order_id:order.id})));
  if(ie){await db.from('orders').delete().eq('id',order.id);throw ie;}
  return NextResponse.json({orderId:order.id,orderNumber:order.order_number,amountKes:order.total_kes},{status:201});
 }catch(e){console.error('Checkout error',e);return NextResponse.json({error:'We could not create your order. Please try again.'},{status:500});}
}
