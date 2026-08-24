"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Status = "idea" | "planning" | "building" | "done";
type Priority = "高" | "中" | "低";
type Task = { id:string; title:string; description:string; category:string; priority:Priority; effort:string; status:Status; createdAt:number };

const columns:{ id:Status; name:string; note:string; color:string }[] = [
  { id:"idea", name:"靈感收集", note:"先記下來，稍後再判斷", color:"#ff7a59" },
  { id:"planning", name:"待規劃", note:"整理需求，準備交給 Codex", color:"#f4ba38" },
  { id:"building", name:"開發中", note:"正在打造或等待測試", color:"#7457d9" },
  { id:"done", name:"已完成", note:"已上線或可正常使用", color:"#41a779" },
];
const seed:Task[] = [
  { id:"podcast-admin", title:"Podcast 後台管理介面", description:"新增、編輯及發布 Podcast 集數，也能查看 RSS 狀態。", category:"LWH Media Center", priority:"高", effort:"大型功能", status:"planning", createdAt:1 },
  { id:"zoho-books", title:"銀行月結單自動入帳", description:"讀取每月銀行月結單，經確認後同步到 Zoho Books。", category:"營運自動化", priority:"中", effort:"需要研究", status:"idea", createdAt:2 },
  { id:"creator-landing", title:"創作者媒體中心 Landing Page", description:"向創作者說明自有平台、內容備份與會員資產的價值。", category:"新產品", priority:"高", effort:"中型功能", status:"building", createdAt:3 },
];
const blankTask = { title:"", description:"", category:"新產品", priority:"中" as Priority, effort:"中型功能", status:"idea" as Status };
const PASSWORD_KEY = "codex-build-list-password-v1";
const UNLOCKED_KEY = "codex-build-list-unlocked-v1";
const MIGRATION_KEY = "codex-build-list-cloud-migrated-v1";
const DIRTY_KEY = "codex-build-list-cloud-pending-v1";
const TASKS_KEY = "codex-build-list-v1";
const PROJECTS_KEY = "codex-build-list-projects-v1";
type PasswordRecord = { salt:string; hash:string; iterations:number };

function bytesToBase64(bytes:Uint8Array){let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return window.btoa(binary)}
function base64ToBytes(value:string){const binary=window.atob(value);return Uint8Array.from(binary,char=>char.charCodeAt(0))}
async function passwordHash(password:string,salt:Uint8Array,iterations=100000){
  const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},material,256);
  return bytesToBase64(new Uint8Array(bits));
}
async function createPasswordRecord(password:string):Promise<PasswordRecord>{const salt=crypto.getRandomValues(new Uint8Array(16));return {salt:bytesToBase64(salt),hash:await passwordHash(password,salt),iterations:100000}}
async function verifyPassword(password:string,record:PasswordRecord){return (await passwordHash(password,base64ToBytes(record.salt),record.iterations))===record.hash}
function pinOnly(value:string){return value.replace(/\D/g,"").slice(0,6)}
function readLocalTasks(){const raw=window.localStorage.getItem(TASKS_KEY);if(!raw)return null;try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed as Task[]:null}catch{return null}}
function readLocalProjects(){const raw=window.localStorage.getItem(PROJECTS_KEY);if(!raw)return null;try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed.filter(item=>typeof item==="string") as string[]:null}catch{return null}}
function readLocalPassword(){const raw=window.localStorage.getItem(PASSWORD_KEY);if(!raw)return null;try{return JSON.parse(raw) as PasswordRecord}catch{return null}}
function mergeForMigration(remote:Task[],local:Task[]){const defaults=new Map(seed.map(task=>[task.id,JSON.stringify(task)]));const merged=new Map(remote.map(task=>[task.id,task]));for(const task of local){const unchangedDefault=defaults.get(task.id)===JSON.stringify(task);if(!unchangedDefault||!merged.has(task.id))merged.set(task.id,task)}return [...merged.values()]}
function projectNames(tasks:Task[],saved:string[]=[]){return [...new Set([...saved,...tasks.map(task=>task.category)].map(name=>name.trim()).filter(Boolean))]}

function Icon({ name, size=18 }:{ name:"plus"|"search"|"grid"|"box"|"spark"|"trash"|"edit"|"arrow"|"arrowBack"|"close"|"settings"|"lock"|"unlock"; size?:number }) {
  const paths = {
    plus:<><path d="M12 5v14M5 12h14" /></>, search:<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    grid:<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    box:<><path d="m4 7 8-4 8 4v10l-8 4-8-4Z" /><path d="m4 7 8 4 8-4M12 11v10" /></>,
    spark:<><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9ZM5 15l.7 2.3L8 18.5l-2.3 1.2L5 22l-.7-2.3L2 18.5l2.3-1.2Z" /></>,
    trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
    edit:<><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>, arrow:<><path d="M5 12h14M14 7l5 5-5 5" /></>, arrowBack:<><path d="M19 12H5M10 7l-5 5 5 5" /></>, close:<><path d="m6 6 12 12M18 6 6 18" /></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,unlock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function Home() {
  const [tasks,setTasks] = useState<Task[]>(seed); const [loaded,setLoaded] = useState(false);
  const [projects,setProjects] = useState<string[]>(projectNames(seed)); const [newProject,setNewProject] = useState(""); const [addingProject,setAddingProject] = useState(false); const [projectError,setProjectError] = useState("");
  const [query,setQuery] = useState(""); const [priority,setPriority] = useState("全部"); const [projectFilter,setProjectFilter] = useState("全部");
  const [modalOpen,setModalOpen] = useState(false); const [editingId,setEditingId] = useState<string|null>(null); const [form,setForm] = useState(blankTask);
  const [settingsOpen,setSettingsOpen] = useState(false); const [hasPassword,setHasPassword] = useState(false);
  const [locked,setLocked] = useState(false); const [passwordReady,setPasswordReady] = useState(false);
  const [unlockInput,setUnlockInput] = useState(""); const [unlockError,setUnlockError] = useState(""); const [unlockBusy,setUnlockBusy] = useState(false);
  const [currentPassword,setCurrentPassword] = useState(""); const [newPassword,setNewPassword] = useState(""); const [confirmPassword,setConfirmPassword] = useState(""); const [settingsMessage,setSettingsMessage] = useState(""); const [settingsError,setSettingsError] = useState(""); const [settingsBusy,setSettingsBusy] = useState(false);
  const [cloudReady,setCloudReady] = useState(false); const [syncState,setSyncState] = useState<"loading"|"saved"|"saving"|"offline">("loading");
  const lastServerJson=useRef(""); const syncQueue=useRef<Promise<void>>(Promise.resolve());
  useEffect(()=>{
    let cancelled=false;
    async function start(){
      const local=readLocalTasks();const localProjects=readLocalProjects();const localPassword=readLocalPassword();
      try{
        const response=await fetch("/api/board",{cache:"no-store"});if(!response.ok)throw new Error("sync unavailable");
        const cloud=await response.json() as {tasks:Task[]|null;projects?:string[];hasPassword:boolean};let next:Task[];
        const needsMigration=!window.localStorage.getItem(MIGRATION_KEY);
        const hasPendingChanges=Boolean(window.localStorage.getItem(DIRTY_KEY));
        if(cloud.tasks===null)next=local??seed;else if(local&&hasPendingChanges)next=local;else next=local&&needsMigration?mergeForMigration(cloud.tasks,local):cloud.tasks;
        const nextProjects=projectNames(next,[...(cloud.projects??[]),...(localProjects??[])]);let hasPassword=cloud.hasPassword;
        if(cloud.tasks===null||(local&&hasPendingChanges)||(local&&needsMigration)||(!cloud.hasPassword&&localPassword&&needsMigration)){
          const saved=await fetch("/api/board",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({tasks:next,projects:nextProjects,migrationPassword:localPassword})});if(!saved.ok)throw new Error("migration failed");const result=await saved.json() as {hasPassword:boolean};hasPassword=result.hasPassword;
        }
        if(cancelled)return;const serialized=JSON.stringify({tasks:next,projects:nextProjects});lastServerJson.current=serialized;setTasks(next);setProjects(nextProjects);window.localStorage.setItem(TASKS_KEY,JSON.stringify(next));window.localStorage.setItem(PROJECTS_KEY,JSON.stringify(nextProjects));window.localStorage.setItem(MIGRATION_KEY,"yes");window.localStorage.removeItem(DIRTY_KEY);setHasPassword(hasPassword);setLocked(hasPassword&&window.sessionStorage.getItem(UNLOCKED_KEY)!=="yes");setCloudReady(true);setSyncState("saved");
      }catch{
        if(cancelled)return;const fallback=local??seed;const fallbackProjects=projectNames(fallback,localProjects??[]);lastServerJson.current=JSON.stringify({tasks:fallback,projects:fallbackProjects});setTasks(fallback);setProjects(fallbackProjects);setHasPassword(Boolean(localPassword));setLocked(Boolean(localPassword)&&window.sessionStorage.getItem(UNLOCKED_KEY)!=="yes");setSyncState("offline");
      }finally{if(!cancelled){setPasswordReady(true);setLoaded(true)}}
    }
    start();return()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    if(!loaded)return;const serialized=JSON.stringify({tasks,projects});window.localStorage.setItem(TASKS_KEY,JSON.stringify(tasks));window.localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));if(!cloudReady){if(serialized!==lastServerJson.current)window.localStorage.setItem(DIRTY_KEY,"yes");return}if(serialized===lastServerJson.current)return;
    const timer=window.setTimeout(()=>{setSyncState("saving");syncQueue.current=syncQueue.current.then(async()=>{const response=await fetch("/api/board",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({tasks,projects})});if(!response.ok)throw new Error("save failed");lastServerJson.current=serialized;window.localStorage.removeItem(DIRTY_KEY);setSyncState("saved")}).catch(()=>{window.localStorage.setItem(DIRTY_KEY,"yes");setSyncState("offline")})},450);return()=>window.clearTimeout(timer);
  },[tasks,projects,loaded,cloudReady]);
  useEffect(()=>{
    if(!cloudReady)return;async function refresh(){if(JSON.stringify({tasks,projects})!==lastServerJson.current)return;try{const response=await fetch("/api/board",{cache:"no-store"});if(!response.ok)return;const cloud=await response.json() as {tasks:Task[]|null;projects?:string[];hasPassword:boolean};if(!cloud.tasks)return;const nextProjects=projectNames(cloud.tasks,cloud.projects??[]);const serialized=JSON.stringify({tasks:cloud.tasks,projects:nextProjects});setHasPassword(cloud.hasPassword);if(serialized!==lastServerJson.current){lastServerJson.current=serialized;setTasks(cloud.tasks);setProjects(nextProjects);window.localStorage.setItem(TASKS_KEY,JSON.stringify(cloud.tasks));window.localStorage.setItem(PROJECTS_KEY,JSON.stringify(nextProjects))}}catch{}}
    const timer=window.setInterval(refresh,15000);window.addEventListener("focus",refresh);return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh)};
  },[cloudReady,tasks,projects]);
  const visibleTasks=useMemo(()=>tasks.filter(task=>`${task.title} ${task.description} ${task.category}`.toLowerCase().includes(query.toLowerCase())&&(priority==="全部"||task.priority===priority)&&(projectFilter==="全部"||task.category===projectFilter)),[tasks,query,priority,projectFilter]);
  function openNew(status:Status="idea"){setEditingId(null);setForm({...blankTask,category:projectFilter!=="全部"?projectFilter:projects.includes(blankTask.category)?blankTask.category:projects[0]??"新產品",status});setModalOpen(true)}
  function openEdit(task:Task){setEditingId(task.id);setForm({title:task.title,description:task.description,category:task.category,priority:task.priority,effort:task.effort,status:task.status});setModalOpen(true)}
  function saveTask(e:FormEvent){e.preventDefault();if(!form.title.trim())return;if(editingId)setTasks(c=>c.map(t=>t.id===editingId?{...t,...form,title:form.title.trim()}:t));else setTasks(c=>[...c,{...form,title:form.title.trim(),id:crypto.randomUUID(),createdAt:Date.now()}]);setModalOpen(false)}
  function moveTask(task:Task){const i=columns.findIndex(c=>c.id===task.status);if(i<columns.length-1)setTasks(c=>c.map(t=>t.id===task.id?{...t,status:columns[i+1].id}:t))}
  function moveTaskBack(task:Task){const i=columns.findIndex(c=>c.id===task.status);if(i>0)setTasks(c=>c.map(t=>t.id===task.id?{...t,status:columns[i-1].id}:t))}
  function addProject(e:FormEvent){e.preventDefault();const name=newProject.trim();if(!name){setProjectError("請輸入項目名稱。");return}if(name.length>40){setProjectError("項目名稱最多 40 個字。");return}if(projects.includes(name)){setProjectError("這個項目已經存在。");return}setProjects(current=>[...current,name]);setNewProject("");setProjectError("");setAddingProject(false)}
  async function unlock(e:FormEvent){e.preventDefault();setUnlockError("");setUnlockBusy(true);let ok=false;try{const response=await fetch("/api/unlock",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:unlockInput})});ok=response.ok&&Boolean((await response.json()).ok)}catch{const record=readLocalPassword();ok=Boolean(record&&await verifyPassword(unlockInput,record))}if(ok){window.sessionStorage.setItem(UNLOCKED_KEY,"yes");setLocked(false);setUnlockInput("")}else setUnlockError("密碼不正確，請再試一次。");setUnlockBusy(false)}
  function openSettings(){setCurrentPassword("");setNewPassword("");setConfirmPassword("");setSettingsMessage("");setSettingsError("");setSettingsOpen(true)}
  async function savePassword(e:FormEvent){
    e.preventDefault();setSettingsError("");setSettingsMessage("");
    if(!/^\d{6}$/.test(newPassword)){setSettingsError("密碼必須剛好是 6 位數字。");return}if(newPassword!==confirmPassword){setSettingsError("兩次輸入的新密碼不一致。");return}
    setSettingsBusy(true);const next=await createPasswordRecord(newPassword);try{const response=await fetch("/api/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword,newRecord:next})});const result=await response.json() as {error?:string};if(!response.ok){setSettingsError(result.error||"密碼更新失敗。");setSettingsBusy(false);return}window.localStorage.setItem(PASSWORD_KEY,JSON.stringify(next));window.sessionStorage.setItem(UNLOCKED_KEY,"yes");setHasPassword(true);setCurrentPassword("");setNewPassword("");setConfirmPassword("");setSettingsMessage(hasPassword?"密碼已更新，所有裝置立即生效。":"進入密碼已啟用，所有裝置立即生效。")}catch{setSettingsError("暫時無法連接雲端，請稍後再試。")}setSettingsBusy(false);
  }
  async function removePassword(){setSettingsError("");setSettingsMessage("");try{const response=await fetch("/api/password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({currentPassword,newRecord:null})});const result=await response.json() as {error?:string};if(!response.ok){setSettingsError(result.error||"密碼移除失敗。");return}window.localStorage.removeItem(PASSWORD_KEY);window.sessionStorage.removeItem(UNLOCKED_KEY);setHasPassword(false);setCurrentPassword("");setSettingsMessage("進入密碼已移除，所有裝置立即生效。")}catch{setSettingsError("暫時無法連接雲端，請稍後再試。")}}
  function lockNow(){window.sessionStorage.removeItem(UNLOCKED_KEY);setSettingsOpen(false);setLocked(true)}
  const done=tasks.filter(t=>t.status==="done").length, active=tasks.filter(t=>t.status==="building").length;

  if(!passwordReady)return <main className="loading-screen" aria-label="載入中"><span className="brand-mark"><Icon name="spark" size={23}/></span></main>;
  if(locked)return <main className="lock-screen"><section className="lock-card"><span className="lock-logo"><Icon name="lock" size={25}/></span><p className="eyebrow">PRIVATE WORKSPACE</p><h1>歡迎回來</h1><p>輸入你的 6 位數字密碼，進入 Codex 功能與產品待辦板。</p><form onSubmit={unlock}><label htmlFor="unlock-password">6 位數字密碼</label><input id="unlock-password" autoFocus type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={unlockInput} onChange={e=>setUnlockInput(pinOnly(e.target.value))} placeholder="••••••" aria-describedby="unlock-hint"/><span className="password-hint" id="unlock-hint">請輸入 6 位數字，手機會自動顯示數字鍵盤。</span><div className="field-note" aria-live="polite">{unlockError}</div><button className="primary-button" type="submit" disabled={unlockBusy||unlockInput.length!==6}>{unlockBusy?"驗證中…":"解鎖待辦板"}<Icon name="unlock" size={17}/></button></form><small>密碼與待辦內容已透過雲端同步。</small></section></main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Icon name="spark" size={21}/></span><span>BUILD<span>LIST</span></span></div>
      <nav aria-label="主要選單"><button className="nav-item active" onClick={()=>{setProjectFilter("全部");setPriority("全部");setQuery("")}}><Icon name="grid"/>功能待辦板</button><button className="nav-item" onClick={()=>setPriority("高")}><Icon name="spark"/>優先項目</button><button className="nav-item" onClick={openSettings}><Icon name="settings"/>設定</button></nav>
      <section className="project-manager" aria-label="項目管理"><div className="project-manager-title"><span>所屬項目</span><button aria-label="新增項目" onClick={()=>{setAddingProject(true);setProjectError("")}}><Icon name="plus" size={15}/></button></div><button className={`project-link ${projectFilter==="全部"?"selected":""}`} onClick={()=>setProjectFilter("全部")}><span>全部項目</span><b>{tasks.length}</b></button>{projects.map(project=><button className={`project-link ${projectFilter===project?"selected":""}`} key={project} onClick={()=>setProjectFilter(project)}><span>{project}</span><b>{tasks.filter(task=>task.category===project).length}</b></button>)}{addingProject&&<form className="project-form" onSubmit={addProject}><input autoFocus maxLength={40} value={newProject} onChange={e=>setNewProject(e.target.value)} placeholder="輸入項目名稱"/><div><button type="button" onClick={()=>{setAddingProject(false);setNewProject("");setProjectError("")}}>取消</button><button type="submit">加入</button></div>{projectError&&<small>{projectError}</small>}</form>}<button className="add-project-button" onClick={()=>{setAddingProject(true);setProjectError("")}}><Icon name="plus" size={14}/>新增項目</button></section>
      <div className="sidebar-note"><Icon name="spark" size={22}/><strong>先記下，再完善</strong><p>不用一開始就把需求想完整。記下核心問題，之後再和 Codex 一起拆解。</p></div>
      <div className="profile"><span>LW</span><div><strong>李偉康</strong><small>個人工作空間</small></div><button className="mobile-settings" aria-label="開啟設定" onClick={openSettings}><Icon name="settings"/></button></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><p className="eyebrow">CODEX BUILD QUEUE</p><h1>想打造什麼？</h1><p className="intro">把產品和功能構想集中在這裡，一步一步交給 Codex 完成。</p></div><div className="topbar-actions"><span className={`sync-status ${syncState}`}><i/>{syncState==="loading"?"連接雲端…":syncState==="saving"?"同步中…":syncState==="offline"?"離線保存":"已同步"}</span><button className="primary-button" onClick={()=>openNew()}><Icon name="plus"/>新增構想</button></div></header>
      <section className="summary" aria-label="待辦摘要">
        <div><span className="summary-icon peach"><Icon name="box"/></span><p>全部構想<strong>{tasks.length}</strong></p></div><div><span className="summary-icon purple"><Icon name="spark"/></span><p>開發中<strong>{active}</strong></p></div><div><span className="summary-icon green">✓</span><p>已完成<strong>{done}</strong></p></div>
        <div className="progress-wrap"><p><span>整體進度</span><strong>{tasks.length?Math.round(done/tasks.length*100):0}%</strong></p><div className="progress"><i style={{width:`${tasks.length?done/tasks.length*100:0}%`}}/></div></div>
      </section>
      <div className="toolbar"><label className="search"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜尋功能、產品或說明…"/></label><div className="filters">{["全部","高","中","低"].map(item=><button key={item} className={priority===item?"selected":""} onClick={()=>setPriority(item)}>{item}{item!=="全部"&&"優先"}</button>)}</div></div>
      <section className="board">{columns.map(column=>{const items=visibleTasks.filter(t=>t.status===column.id);return <div className="column" key={column.id}>
        <div className="column-header"><div><span style={{background:column.color}}/><h2>{column.name}</h2><b>{items.length}</b></div><p>{column.note}</p></div>
        <div className="cards">{items.map(task=><article className="task-card" key={task.id}><div className="card-top"><span className={`priority p-${task.priority}`}>{task.priority}優先</span><span className="effort">{task.effort}</span></div><div className="task-title-row"><h3>{task.title}</h3>{task.status==="done"&&<span className="completion-trophy" role="img" aria-label="已完成獎盃">🏆</span>}</div><p>{task.description||"尚未加入說明。"}</p><div className="card-footer"><span>{task.category}</span><div><button aria-label={`編輯 ${task.title}`} onClick={()=>openEdit(task)}><Icon name="edit" size={16}/></button>{task.status!=="idea"&&<button aria-label={`將 ${task.title} 退回上一階段`} onClick={()=>moveTaskBack(task)}><Icon name="arrowBack" size={16}/></button>}{task.status!=="done"&&<button aria-label={`將 ${task.title} 移到下一階段`} onClick={()=>moveTask(task)}><Icon name="arrow" size={16}/></button>}</div></div></article>)}
        {items.length===0&&<div className="empty"><span>＋</span><p>這一欄還沒有項目</p><button onClick={()=>openNew(column.id)}>加入一個構想</button></div>}</div><button className="add-inline" onClick={()=>openNew(column.id)}><Icon name="plus" size={16}/>新增至「{column.name}」</button></div>})}</section>
    </section>
    {modalOpen&&<div className="modal-backdrop" onMouseDown={()=>setModalOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" aria-label="關閉" onClick={()=>setModalOpen(false)}><Icon name="close"/></button><p className="eyebrow">{editingId?"EDIT ITEM":"NEW IDEA"}</p><h2 id="modal-title">{editingId?"編輯構想":"記下一個新構想"}</h2><p className="modal-lead">只要先寫下核心想法，其他細節可以稍後補上。</p>
      <form onSubmit={saveTask}><label>功能或產品名稱<input autoFocus required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：Podcast 後台管理"/></label><label>想解決什麼問題？<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="簡單說明使用情境和預期成果…"/></label>
      <div className="form-grid"><label>所屬項目<select required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{projects.map(project=><option value={project} key={project}>{project}</option>)}</select></label><label>目前階段<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})}>{columns.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>優先級<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})}><option>高</option><option>中</option><option>低</option></select></label><label>預計投入<select value={form.effort} onChange={e=>setForm({...form,effort:e.target.value})}><option>快速修改</option><option>中型功能</option><option>大型功能</option><option>需要研究</option></select></label></div>
      <div className="form-actions">{editingId&&<button type="button" className="delete-button" onClick={()=>{setTasks(c=>c.filter(t=>t.id!==editingId));setModalOpen(false)}}><Icon name="trash" size={16}/>刪除</button>}<button type="button" className="cancel-button" onClick={()=>setModalOpen(false)}>取消</button><button type="submit" className="primary-button">{editingId?"儲存修改":"加入待辦板"}</button></div></form></section></div>}
    {settingsOpen&&<div className="modal-backdrop" onMouseDown={()=>setSettingsOpen(false)}><section className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" aria-label="關閉" onClick={()=>setSettingsOpen(false)}><Icon name="close"/></button><p className="eyebrow">SETTINGS</p><h2 id="settings-title">安全設定</h2><p className="modal-lead">設定固定 6 位數字的進入密碼。關閉瀏覽器工作階段後，系統會再次要求密碼。</p>
      <div className={`security-status ${hasPassword?"enabled":""}`}><span><Icon name={hasPassword?"lock":"unlock"}/></span><div><strong>{hasPassword?"密碼保護已啟用":"尚未設定進入密碼"}</strong><p>{hasPassword?"同一組密碼適用於你的所有裝置。":"設定後，密碼會同步到手機和電腦。"}</p></div></div>
      <form onSubmit={savePassword}>{hasPassword&&<label>目前密碼<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(pinOnly(e.target.value))} placeholder="輸入目前的 6 位數字"/></label>}<label>{hasPassword?"新密碼":"設定密碼"}<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(pinOnly(e.target.value))} placeholder="輸入 6 位數字"/><span className="password-hint">只能使用 0–9，必須剛好 6 位；可以包含開頭的 0。</span></label><label>確認新密碼<input type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(pinOnly(e.target.value))} placeholder="再次輸入相同的 6 位數字"/></label><div className={`settings-feedback ${settingsError?"error":""}`} aria-live="polite">{settingsError||settingsMessage}</div>
      <div className="form-actions settings-actions">{hasPassword&&<button type="button" className="delete-button" onClick={removePassword}>移除密碼</button>}{hasPassword&&<button type="button" className="cancel-button" onClick={lockNow}><Icon name="lock" size={15}/>立即鎖定</button>}<button type="submit" className="primary-button" disabled={settingsBusy}>{settingsBusy?"儲存中…":hasPassword?"更新密碼":"啟用密碼"}</button></div></form></section></div>}
  </main>;
}
