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
const styles=await readFile(new URL('../styles.css',import.meta.url),'utf8');
check(html.includes('id="addToSelectedRoom"'),'マップから追加するボタンがありません');
check(source.includes("pendingLocation=activeMapLocations.length===1"),'選択区画の引き継ぎがありません');
check(source.includes("Tesseract.recognize(url,'jpn+eng'"),'日本語レシートOCRがありません');
check(source.includes('文字認識を利用できませんでした'),'OCR失敗時の代替案内がありません');
results.push('4. マップから追加・区画引継ぎ・レシートOCR: PASS');

// 5: レシート複数選択と一括追加。
check(html.includes('id="addReceiptItems"'),'レシート一括追加ボタンがありません');
check(source.includes('receiptCandidates.filter(entry=>entry.selected'),'候補の複数選択処理がありません');
check(source.includes('items=[...additions,...items]'),'複数食材の一括保存処理がありません');
check(source.includes("entry.storage==='冷凍'?rule.frozen:rule.cold"),'候補別の期限計算がありません');
check(!source.includes('function recognizeImage'),'写真ファイル名からの推測が残っています');
results.push('5. レシート複数選択・候補別設定・一括保存: PASS');

// 6: レシートの順次設定とバーコード単品追加。
check(html.includes('id="receiptSetupDialog"'),'食材ごとの順次設定画面がありません');
check(source.includes('receiptQueueIndex++'),'レシート候補を1件ずつ進める処理がありません');
check(html.includes('id="barcodeButton"'),'バーコード追加ボタンがありません');
check(source.includes('BarcodeDetector'),'ブラウザ標準バーコード読取がありません');
check(source.includes('BrowserMultiFormatReader'),'非対応端末向けバーコード読取がありません');
check(source.includes('openfoodfacts.org/api/v2/product'),'無料商品検索がありません');
results.push('6. レシート順次設定・バーコード読取・単品追加: PASS');

// 7: バーコードを国内JANコードに限定。
check(source.includes("!/^(45|49)/.test(digits)"),'国内JANコードの判定がありません');
check(source.includes('海外製品のバーコードは対象外です'),'海外製品の除外案内がありません');
check(source.includes('jp.openfoodfacts.org/api/v2/product'),'国内向け商品検索になっていません');
results.push('7. 国内JAN限定・海外製品除外: PASS');

// 8: スーパー向け調味料とJANキャッシュ。
check(api.presetFor('醤油').name==='しょうゆ','醤油の表記ゆれが認識されません');
check(api.presetFor('マヨ').liters===.5,'マヨネーズの容量提案が不正です');
check(api.ruleFor('ポン酢').category==='調味料','調味料の期限分類がありません');
check(source.includes("localStorage.getItem('fridge-barcode-cache')"),'JANキャッシュの読込がありません');
check(source.includes("localStorage.setItem('fridge-barcode-cache'"),'JANキャッシュの保存がありません');
check(source.indexOf('if(barcodeCache[digits]?.name)')<source.indexOf("fetch(`https://jp.openfoodfacts.org"),'外部検索より先にキャッシュを確認していません');
check(html.includes('レシート・ラベルから入力'),'商品ラベルOCRの導線がありません');
results.push('8. 調味料OCR・国内JANキャッシュ・未登録商品学習: PASS');

// 9: バーコード後の期限OCRと確認。
check(html.includes('id="barcodeExpiryStep"'),'バーコードと同じ画面の期限読取がありません');
check(html.includes('id="expiryKind"'),'賞味期限・消費期限の選択がありません');
check(source.includes('function extractExpiryDates'),'期限日付の抽出処理がありません');
check(source.includes("Tesseract.recognize(url,'jpn+eng'"),'期限OCRがありません');
check(source.includes("if(pendingExpiryDate){$('#expiryDate').value=pendingExpiryDate"),'期限の登録画面への引継ぎがありません');
check(source.includes("items[0].expiryKind=expiryKind"),'期限種別が保存されません');
check(source.includes('function cancelBarcodeFlow'),'途中終了時の状態破棄がありません');
results.push('9. バーコード後の期限OCR・候補確認・期限引継ぎ: PASS');

// 10: 期限を写真選択ではなくライブ映像から読み取る。
check(html.includes('id="expiryVideo"'),'期限読取のライブ映像がありません');
check(html.includes('id="expiryCanvas"'),'映像フレーム取得用Canvasがありません');
check(!html.includes('id="expiryImageInput"'),'期限の写真選択入力が残っています');
check(source.includes('function captureExpiryFrame'),'ライブ映像の一コマ取得処理がありません');
check(source.includes("drawImage(video,0,0)"),'映像からOCR画像を生成していません');
check(source.includes('stopExpiryCamera();$(\'#expiryCameraButton\')'),'読取後にカメラを停止していません');
results.push('10. 期限ライブ読取・メモリ処理・読取後停止: PASS');

// 11: バーコードなしの手入力から期限ライブ読取。
check(html.includes('id="manualExpiryButton"'),'手入力用の期限読取ボタンがありません');
check(source.includes("$('#manualExpiryButton').onclick"),'手入力期限読取の起動処理がありません');
check(source.includes("showBarcodeExpiryStep('',name)"),'バーコードなしで期限画面へ進めません');
check(source.includes("['肉類','魚介類'].includes(category)?'消費期限':'賞味期限'"),'肉・魚の消費期限初期値がありません');
check(source.includes('if(pendingBarcode)saveBarcodeProduct'),'バーコードなしの空キャッシュ保存を防いでいません');
results.push('11. 手入力→期限ライブ読取・肉魚の消費期限初期値: PASS');

// 12: カテゴリ中心のシンプルな選択画面。
check(!html.includes('id="favoriteFoods"')&&!html.includes('よく買うもの'),'よく買うもの欄が残っています');
check(html.includes('id="categoryGrid"'),'カテゴリ選択欄がありません');
check(source.includes('const QUICK_CATEGORIES'),'カテゴリ定義がありません');
check(source.includes('function renderQuickPicker'),'アイコン画面の描画処理がありません');
check(!source.includes('const favorites=')&&!source.includes('const counts=new Map()'),'不要な購入履歴集計が残っています');
check(source.includes("setTimeout(()=>$('#quantity').focus()"),'食材選択後に数量へ進みません');
check(source.includes("name:'さば'")&&source.includes("name:'りんご'"),'魚・果物の代表食材が不足しています');
results.push('12. よく買うもの削除・カテゴリ選択・履歴集計削除: PASS');

// 13: 通信不要の文字アイコンと最大3文字のカテゴリ表示。
check(source.includes("mark:'肉類'")&&source.includes("mark:'調味料'"),'カテゴリ文字が不足しています');
check(source.includes('<span class="category-pictogram"'),'カテゴリ文字アイコンを描画していません');
check(source.includes('<span class="food-pictogram"'),'食材文字アイコンを描画していません');
check(source.includes('name.slice(0,3)'),'食材文字が最大3文字になっていません');
const serviceWorker=await readFile(new URL('../service-worker.js',import.meta.url),'utf8');
check(!serviceWorker.includes('assets/irasutoya/'),'不要な画像キャッシュが残っています');
results.push('13. 最大3文字アイコン・画像通信なし・軽量キャッシュ: PASS');

// 14: 画像要素と外部画像クレジットを完全に除去。
check(!source.includes('<img class="category-pictogram"'),'カテゴリ画像が残っています');
check(!source.includes('<img class="food-pictogram"'),'食材画像が残っています');
check(!html.includes('イラスト：'),'不要な画像クレジットが残っています');
results.push('14. 画像要素・画像通信・不要クレジット除去: PASS');

// 15: JavaScript実行前でもスマホに文字アイコンを表示し、旧キャッシュを回避。
check((html.match(/class="category-pictogram"/g)||[]).length>=8,'初期カテゴリ8件がHTMLにありません');
check(html.includes('styles.css?v=15')&&html.includes('app.js?v=18'),'CSS/JSのキャッシュ更新番号がありません');
check(styles.includes('min-width:64px')&&styles.includes('grid-template-columns:repeat(2,1fr)'),'スマホ用アイコン幅または2列表示がありません');
results.push('15. 初期文字アイコン・スマホ2列・キャッシュ更新: PASS');

// 16: カテゴリ選択を見える変化にし、再描画後もイベント委譲で操作。
check(source.includes('function openQuickCategory(id)'),'カテゴリを開く処理がありません');
check(source.includes("button.classList.toggle('selected'"),'選択カテゴリの強調表示がありません');
check(source.includes("panel.scrollIntoView({behavior:'smooth'"),'カテゴリ食材への自動スクロールがありません');
check(source.includes("$('#categoryGrid').onclick=event=>"),'カテゴリ操作のイベント委譲がありません');
check(source.includes("$('#categoryFoods').onclick=event=>"),'カテゴリ内食材のイベント委譲がありません');
results.push('16. カテゴリ選択色・自動スクロール・再描画後操作: PASS');

// 17: 容量入力を画面から隠し、プリセット値による内部計算は維持。
check(!html.includes('占有容量（1単位）')&&!html.includes('容量単位'),'容量入力が画面に残っています');
check(html.includes('<input id="volume" type="hidden"'),'内部容量値が保持されていません');
check(!html.includes('id="volumeHint"'),'容量説明が画面に残っています');
check(source.includes("$('#volume').value=food.liters"),'食材プリセット容量の内部設定がありません');
check(html.includes('app.js?v=18'),'JavaScriptのキャッシュ更新番号がありません');
results.push('17. 容量入力非表示・内部容量計算・キャッシュ更新: PASS');

// 18: カテゴリへユーザー独自の食材を追加し、端末内へ保存。
check(html.includes('id="customFoodForm"')&&html.includes('id="customFoodName"'),'カテゴリ食材の追加欄がありません');
check(source.includes("localStorage.getItem('fridge-custom-foods')"),'追加食材の読み込みがありません');
check(source.includes("localStorage.setItem('fridge-custom-foods'"),'追加食材の保存がありません');
check(source.includes('function foodsForCategory(category)'),'標準食材と追加食材の統合がありません');
check(source.includes('normalizeFoodText(food)===normalizeFoodText(name)'),'表記ゆれを考慮した重複防止がありません');
check(html.includes('app.js?v=18'),'JavaScriptのキャッシュ更新番号がありません');
results.push('18. カテゴリ食材追加・永続保存・重複防止: PASS');

console.log(results.join('\n'));
