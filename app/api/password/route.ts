import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { boards } from "../../../db/schema";

type PasswordRecord={salt:string;hash:string;iterations:number};
function owner(request:Request){return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()||null}
function validRecord(value:unknown):value is PasswordRecord{if(!value||typeof value!=="object")return false;const r=value as Record<string,unknown>;return typeof r.salt==="string"&&r.salt.length<100&&typeof r.hash==="string"&&r.hash.length<200&&typeof r.iterations==="number"&&r.iterations>=100000&&r.iterations<=500000}
function base64ToBytes(value:string){const binary=atob(value);return Uint8Array.from(binary,char=>char.charCodeAt(0))}
function bytesToBase64(bytes:Uint8Array){let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)}
async function verify(pin:string,record:PasswordRecord){const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:base64ToBytes(record.salt),iterations:record.iterations},material,256);return bytesToBase64(new Uint8Array(bits))===record.hash}

export async function POST(request:Request){
  const email=owner(request);if(!email)return Response.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null) as {currentPassword?:unknown;newRecord?:unknown}|null;if(!body)return Response.json({error:"Invalid request"},{status:400});
  const db=getDb();const [row]=await db.select().from(boards).where(eq(boards.ownerEmail,email)).limit(1);if(!row)return Response.json({error:"Board unavailable"},{status:409});
  if(row.passwordJson){if(typeof body.currentPassword!=="string"||!/^\d{6}$/.test(body.currentPassword)||!(await verify(body.currentPassword,JSON.parse(row.passwordJson) as PasswordRecord)))return Response.json({error:"目前密碼不正確。"},{status:403})}
  if(body.newRecord!==null&&!validRecord(body.newRecord))return Response.json({error:"新密碼格式不正確。"},{status:400});
  const next=body.newRecord===null?null:JSON.stringify(body.newRecord);await db.update(boards).set({passwordJson:next,revision:row.revision+1,updatedAt:Date.now()}).where(eq(boards.ownerEmail,email));
  return Response.json({ok:true,hasPassword:Boolean(next)});
}
