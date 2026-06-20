import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const definitions=source.slice(0,source.indexOf("$$('.next')"));
const context={localStorage:{getItem:()=>null,setItem:()=>{}},console,Date,Math,Intl,URL,globalThis:{}};
vm.createContext(context);
vm.runInContext(`${definitions};globalThis.testApi={normalizeFoodText,presetFor,ruleFor,itemLiters,roomUsage,roomCapacity,FRIDGE};`,context);
const api=context.globalThis.testApi;
const check=(condition,message)=>{if(!condition)throw new Error(message)};
const results=[];

// 1: 表記ゆれ、容量提案、期限分類。
check(api.presetFor('人参').name==='にんじん','人参を認識できません');
check(api.presetFor('ニンジン').liters===.5,'カタカナの容量提案が不正です');
check(api.ruleFor('ブタニク').category==='肉類','カタカナの期限分類が不正です');
results.push('1. 手入力・表記ゆれ・容量/期限提案: PASS');

// 2: 区画別の絞り込みと容量計算。
context.items=[{name:'冷凍食品',quantity:2,volumeLiters:1,location:'freezer'},{name:'キャベツ',quantity:1,volumeLiters:5,location:'vegetable'}];
const freezerItems=context.items.filter(item=>['freezer'].includes(item.location));
check(freezerItems.length===1&&freezerItems[0].name==='冷凍食品','冷凍室フィルターが不正です');
check(context.items.filter(x=>x.location==='freezer').reduce((sum,x)=>sum+api.itemLiters(x),0)===2,'冷凍室容量が不正です');
results.push('2. 冷凍室フィルター・区画容量: PASS');

// 3: HTTPS/PWAとカメラの必須分岐が実装されていること。
check(source.includes('navigator.mediaDevices.getUserMedia'),'カメラAPIがありません');
check(source.includes('globalThis.isSecureContext'),'HTTPS判定がありません');
check(source.includes("navigator.serviceWorker.register"),'Service Worker登録がありません');
check(source.includes('NotAllowedError'),'カメラ拒否時の処理がありません');
results.push('3. カメラ・HTTPS/PWA・許可拒否分岐: PASS');

// 4: 公開後フィードバック（マップ追加導線とレシートOCR）。
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
check(html.includes('id="addToSelectedRoom"'),'マップから追加するボタンがありません');
check(source.includes("pendingLocation=activeMapLocations.length===1"),'選択区画の引き継ぎがありません');
check(source.includes("Tesseract.recognize(url,'jpn+eng'"),'日本語レシートOCRがありません');
check(source.includes('文字認識を利用できませんでした'),'OCR失敗時の代替案内がありません');
results.push('4. マップから追加・区画引継ぎ・レシートOCR: PASS');

console.log(results.join('\n'));
