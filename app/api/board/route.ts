import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { boards } from "../../../db/schema";

type Status = "idea" | "planning" | "building" | "done";
type Priority = "高" | "中" | "低";
type Task = { id:string; title:string; description:string; category:string; priority:Priority; effort:string; status:Status; createdAt:number };
type PasswordRecord = { salt:string; hash:string; iterations:number };

function owner(request:Request){return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()||null}
function validTask(value:unknown):value is Task{
  if(!value||typeof value!=="object")return false;const task=value as Record<string,unknown>;
  return typeof task.id==="string"&&typeof task.title==="string"&&typeof task.description==="string"&&typeof task.category==="string"&&["高","中","低"].includes(String(task.priority))&&typeof task.effort==="string"&&["idea","planning","building","done"].includes(String(task.status))&&typeof task.createdAt==="number";
}
function validPasswordRecord(value:unknown):value is PasswordRecord{
  if(!value||typeof value!=="object")return false;const record=value as Record<string,unknown>;
  return typeof record.salt==="string"&&record.salt.length<100&&typeof record.hash==="string"&&record.hash.length<200&&typeof record.iterations==="number"&&record.iterations>=100000&&record.iterations<=500000;
}
function normalizeProjects(value:unknown,tasks:Task[]){
  const saved=Array.isArray(value)?value.filter((item):item is string=>typeof item==="string"&&item.trim().length>0&&item.trim().length<=80).map(item=>item.trim()):[];
  return [...new Set([...saved,...tasks.map(task=>task.category.trim()).filter(Boolean)])];
}

export async function GET(request:Request){
  const email=owner(request);if(!email)return Response.json({error:"Unauthorized"},{status:401});
  const db=getDb();const [row]=await db.select().from(boards).where(eq(boards.ownerEmail,email)).limit(1);
  if(!row)return Response.json({tasks:null,revision:0,hasPassword:false});
  const resetEnv=env as unknown as {PASSWORD_RESET_TOKEN?:string;PASSWORD_RESET_RECORD?:string};let passwordJson=row.passwordJson;
  const consumedToken=resetEnv.PASSWORD_RESET_TOKEN?`consumed:${resetEnv.PASSWORD_RESET_TOKEN}`:null;
  if(resetEnv.PASSWORD_RESET_TOKEN&&resetEnv.PASSWORD_RESET_RECORD&&row.passwordResetToken!==resetEnv.PASSWORD_RESET_TOKEN&&row.passwordResetToken!==consumedToken){
    try{const record=JSON.parse(resetEnv.PASSWORD_RESET_RECORD);if(validPasswordRecord(record)){passwordJson=JSON.stringify(record);await db.update(boards).set({passwordJson,passwordResetToken:resetEnv.PASSWORD_RESET_TOKEN,revision:row.revision+1,updatedAt:Date.now()}).where(eq(boards.ownerEmail,email))}}catch{}
  }
  let tasks:Task[]=[];let projects:string[]=[];try{const parsed=JSON.parse(row.tasksJson);if(Array.isArray(parsed))tasks=parsed.filter(validTask);else if(parsed&&typeof parsed==="object"){const board=parsed as {tasks?:unknown;projects?:unknown};if(Array.isArray(board.tasks))tasks=board.tasks.filter(validTask);projects=normalizeProjects(board.projects,tasks)}}catch{}
  projects=normalizeProjects(projects,tasks);
  return Response.json({tasks,projects,revision:row.revision,hasPassword:Boolean(passwordJson),updatedAt:row.updatedAt});
}

export async function PUT(request:Request){
  const email=owner(request);if(!email)return Response.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null) as {tasks?:unknown;projects?:unknown;migrationPassword?:unknown}|null;
  if(!body||!Array.isArray(body.tasks)||body.tasks.length>1000||!body.tasks.every(validTask))return Response.json({error:"Invalid tasks"},{status:400});
  if(body.projects!==undefined&&(!Array.isArray(body.projects)||body.projects.length>100||!body.projects.every(item=>typeof item==="string"&&item.trim().length>0&&item.trim().length<=80)))return Response.json({error:"Invalid projects"},{status:400});
  const db=getDb();const [existing]=await db.select().from(boards).where(eq(boards.ownerEmail,email)).limit(1);
  const migrationPassword=validPasswordRecord(body.migrationPassword)?JSON.stringify(body.migrationPassword):null;
  const now=Date.now();const projects=normalizeProjects(body.projects,body.tasks as Task[]);const tasksJson=JSON.stringify({tasks:body.tasks,projects});
  if(existing){
    const passwordJson=existing.passwordJson??migrationPassword;
    await db.update(boards).set({tasksJson,passwordJson,revision:existing.revision+1,updatedAt:now}).where(eq(boards.ownerEmail,email));
    return Response.json({revision:existing.revision+1,hasPassword:Boolean(passwordJson),updatedAt:now});
  }
  await db.insert(boards).values({ownerEmail:email,tasksJson,passwordJson:migrationPassword,revision:1,updatedAt:now});
  return Response.json({revision:1,hasPassword:Boolean(migrationPassword),updatedAt:now});
}
