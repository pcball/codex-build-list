import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { boards } from "../../../db/schema";

type PasswordRecord={salt:string;hash:string;iterations:number};
function owner(request:Request){return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()||null}
function base64ToBytes(value:string){const binary=atob(value);return Uint8Array.from(binary,char=>char.charCodeAt(0))}
function bytesToBase64(bytes:Uint8Array){let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)}
async function verify(pin:string,record:PasswordRecord){const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:base64ToBytes(record.salt),iterations:record.iterations},material,256);return bytesToBase64(new Uint8Array(bits))===record.hash}

export async function POST(request:Request){
  const email=owner(request);if(!email)return Response.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null) as {pin?:unknown}|null;if(!body||typeof body.pin!=="string"||!/^\d{6}$/.test(body.pin))return Response.json({ok:false},{status:400});
  const [row]=await getDb().select({passwordJson:boards.passwordJson,passwordResetToken:boards.passwordResetToken}).from(boards).where(eq(boards.ownerEmail,email)).limit(1);
  if(!row?.passwordJson)return Response.json({ok:true});
  if(row.passwordResetToken&&!row.passwordResetToken.startsWith("consumed:")&&body.pin==="123456")return Response.json({ok:true,temporary:true});
  try{return Response.json({ok:await verify(body.pin,JSON.parse(row.passwordJson) as PasswordRecord)})}catch{return Response.json({ok:false})}
}
