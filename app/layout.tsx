import type { Metadata } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Codex 功能與產品待辦板",description:"集中整理想交給 Codex 打造的功能、產品構想與開發進度。",icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-Hant"><body>{children}</body></html>}
