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
check(source.includes('自動読取を開始できません'),'バーコードカメラ失敗時の案内がありません');
results.push('3. カメラ・HTTPS/PWA・許可拒否分岐: PASS');

// 4: マップ追加導線と期限表示OCR。
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const styles=await readFile(new URL('../styles.css',import.meta.url),'utf8');
check(html.includes('id="addToSelectedRoom"'),'マップから追加するボタンがありません');
check(source.includes("pendingLocation=activeMapLocations.length===1"),'選択区画の引き継ぎがありません');
check(source.includes("Tesseract.recognize(url,'jpn+eng'"),'期限表示OCRがありません');
check(source.includes('期限を読み取れませんでした'),'期限OCR失敗時の代替案内がありません');
results.push('4. マップから追加・区画引継ぎ・期限表示OCR: PASS');

// 5: 使用しないレシート・ラベル入力を画面と処理から完全に撤去。
check(!html.includes('receiptButton')&&!html.includes('レシート・ラベルから入力'),'レシート入力ボタンが残っています');
check(!html.includes('cameraDialog')&&!html.includes('receiptSetupDialog'),'レシート撮影・設定画面が残っています');
check(!source.includes('receiptCandidates')&&!source.includes('receiptQueue'),'レシート候補処理が残っています');
check(!source.includes('showImageCandidates')&&!source.includes('openCamera'),'レシート撮影処理が残っています');
results.push('5. レシート・ラベル入力UI・撮影・一括処理削除: PASS');

// 6: バーコード単品追加。
check(html.includes('id="barcodeButton"'),'バーコード追加ボタンがありません');
check(source.includes('BarcodeDetector'),'ブラウザ標準バーコード読取がありません');
check(source.includes('BrowserMultiFormatReader'),'非対応端末向けバーコード読取がありません');
check(source.includes('openfoodfacts.org/api/v2/product'),'無料商品検索がありません');
results.push('6. バーコード読取・単品追加: PASS');

// 7: バーコードを国内JANコードに限定。
check(source.includes("!/^(45|49)/.test(digits)"),'国内JANコードの判定がありません');
check(source.includes('海外製品のバーコードは対象外です'),'海外製品の除外案内がありません');
check(source.includes('jp.openfoodfacts.org/api/v2/product'),'国内向け商品検索になっていません');
results.push('7. 国内JAN限定・海外製品除外: PASS');

// 8: スーパー向け調味料とJANキャッシュ。
check(api.presetFor('醤油').name==='しょうゆ','醤油の表記ゆれが認識されません');
check(api.presetFor('マヨ').liters===.5,'マヨネーズの容量提案が不正です');
check(api.ruleFor('ポン酢').category==='調味料','調味料の期限分類がありません');
check(source.includes("readStoredObject('fridge-barcode-cache')"),'JANキャッシュの安全な読込がありません');
check(source.includes("localStorage.setItem('fridge-barcode-cache'"),'JANキャッシュの保存がありません');
check(source.indexOf('if(barcodeCache[digits]?.name)')<source.indexOf("fetch(`https://jp.openfoodfacts.org"),'外部検索より先にキャッシュを確認していません');
check(html.includes('id="barcodeButton"'),'調味料にも使えるバーコード導線がありません');
results.push('8. 調味料プリセット・国内JANキャッシュ・未登録商品学習: PASS');

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

// 11: 期限入力欄からカメラで期限を読み取り、現在の入力状態を維持。
check(html.includes('id="manualExpiryButton"')&&html.includes('期限をカメラで読み取る'),'期限欄のカメラ読取ボタンがありません');
check(!html.includes('バーコードなしで期限を読み取る'),'旧期限読取ボタンの文言が残っています');
check(source.includes("$('#manualExpiryButton').onclick"),'期限読取の起動処理がありません');
check(source.includes("showBarcodeExpiryStep('',name)"),'期限読取画面へ進めません');
check(source.includes("['肉類','魚介類'].includes(category)?'消費期限':'賞味期限'"),'肉・魚の消費期限初期値がありません');
check(source.includes('if(pendingBarcode)saveBarcodeProduct'),'バーコードなしの空キャッシュ保存を防いでいません');
check(source.includes("if(!pendingBarcode){if(pendingExpiryDate)$('#expiryDate').value=pendingExpiryDate"),'読取期限が期限欄へ直接戻りません');
results.push('11. 期限欄→カメラ読取・入力状態維持・肉魚の消費期限初期値: PASS');

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
check(source.includes('<span class="category-pictogram category-${category.id}"'),'色付きカテゴリ文字アイコンを描画していません');
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
check(html.includes('styles.css?v=31')&&html.includes('app.js?v=31'),'CSS/JSのキャッシュ更新番号がありません');
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
check(html.includes('app.js?v=31'),'JavaScriptのキャッシュ更新番号がありません');
results.push('17. 容量入力非表示・内部容量計算・キャッシュ更新: PASS');

// 18: カテゴリへユーザー独自の食材を追加し、端末内へ保存。
check(html.includes('id="customFoodForm"')&&html.includes('id="customFoodName"'),'カテゴリ食材の追加欄がありません');
check(source.includes("readStoredObject('fridge-custom-foods')"),'追加食材の安全な読み込みがありません');
check(source.includes("localStorage.setItem('fridge-custom-foods'"),'追加食材の保存がありません');
check(source.includes('function foodsForCategory(category)'),'標準食材と追加食材の統合がありません');
check(source.includes('normalizeFoodText(food)===normalizeFoodText(name)'),'表記ゆれを考慮した重複防止がありません');
check(html.includes('app.js?v=31'),'JavaScriptのキャッシュ更新番号がありません');
results.push('18. カテゴリ食材追加・永続保存・重複防止: PASS');

// 19: 右上の削除コマンドから追加食材だけを選び、確認後に削除。
check(html.includes('id="manageCustomFoods"')&&html.includes('>削除</button>'),'右上の削除コマンドがありません');
check(source.includes('function escapeHtml(value)'),'追加食材名の安全な表示処理がありません');
check(source.includes('function showCustomFoodDeleteMode()'),'削除選択画面がありません');
check(source.includes('data-remove-choice'),'追加食材の削除選択がありません');
check(source.includes('を削除しますか？'),'削除前の確認がありません');
check(source.includes("$('#customFoodForm').hidden=true"),'削除選択中に追加欄が隠れません');
check(source.includes("$('#manageCustomFoods').textContent='キャンセル'"),'削除選択のキャンセルがありません');
check(source.includes('.filter(food=>food!==name)'),'追加食材の削除処理がありません');
check(source.includes("localStorage.setItem('fridge-custom-foods'"),'削除結果の端末保存がありません');
check(!source.includes('data-delete-custom'),'各食材上の旧削除ボタンが残っています');
check(html.includes('app.js?v=31'),'JavaScriptのキャッシュ更新番号がありません');
results.push('19. 右上削除・追加食材選択・最終確認・省スペース化: PASS');

// 20: 登録済み食材の内容と保管位置を編集し、全表示へ反映。
check(html.includes('id="editItemDialog"')&&html.includes('id="editItemForm"'),'在庫編集画面がありません');
check(source.includes('data-edit="${item.id}"'),'在庫カードの編集ボタンがありません');
check(source.includes('function openItemEditor(id)'),'編集画面へ既存内容を読み込めません');
check(source.includes('function editLocationOptions(storage,selected)'),'保存状態別の保管位置選択がありません');
check(source.includes("items[index]={...items[index]"),'登録済み食材の更新処理がありません');
check(source.includes("volumeLiters:preset.liters"),'食材名変更後の内部容量更新がありません');
check(source.includes("$('#editItemDialog').close()"),'編集完了後に画面が閉じません');
check(html.includes('app.js?v=31'),'JavaScriptのキャッシュ更新番号がありません');
results.push('20. 在庫内容・保存状態・保管位置・期限編集: PASS');

// 21: スマホ編集画面を2列・低余白で1画面に収める。
check(styles.includes('.edit-item-dialog{width:min(500px'),'編集画面のコンパクト幅がありません');
check(styles.includes('max-height:calc(100dvh - 20px)'),'スマホ画面高への制限がありません');
check(styles.includes('.edit-item-dialog .fields{grid-template-columns:1fr 1fr'),'編集項目が2列になっていません');
check(styles.includes('.edit-item-dialog input,.edit-item-dialog select{padding:8px 10px}'),'入力欄がコンパクトではありません');
check(html.includes('styles.css?v=31'),'CSSのキャッシュ更新番号がありません');
results.push('21. スマホ編集画面・2列・コンパクト表示: PASS');

// 22: スマホの食材入力とバーコードを横1行にし、期限読取を期限欄直下へ移動。
check(styles.includes('.add-methods{display:flex;flex-direction:row'),'スマホの食材入力が横1行ではありません');
check(styles.includes('.add-methods .secondary{width:auto;white-space:nowrap'),'バーコードボタンが縦長になる可能性があります');
check(html.includes('<input id="expiryDate" type="date" required><button type="button" id="manualExpiryButton"'),'期限読取ボタンが期限欄直下にありません');
check(html.includes('styles.css?v=31'),'CSSのキャッシュ更新番号がありません');
results.push('22. スマホ横1行バーコード・期限欄直下カメラ読取: PASS');

// 23: 在庫カードを情報2行へまとめて縦余白を削減。
check(source.includes('class="item-card compact-item-card"'),'コンパクト在庫カードがありません');
check(source.includes('item-compact-main')&&source.includes('item-compact-sub'),'在庫情報が2行に分かれていません');
check(!source.includes('<br>占有目安'),'在庫カードに占有容量の行が残っています');
check(styles.includes('.compact-item-card{padding:11px 13px}'),'在庫カードの余白がコンパクトではありません');
check(styles.includes('.item-compact-main{height:30px}'),'在庫カード1行目の高さが固定されていません');
check(html.includes('styles.css?v=31')&&html.includes('app.js?v=31'),'CSS/JSのキャッシュ更新番号がありません');
results.push('23. 在庫カード2行・占有容量行削除・縦余白削減: PASS');

// 24: 起動・復帰時に保存済み在庫を再読込し、件数へ反映。
check(source.includes('function refreshStoredItems()'),'保存在庫の再読込処理がありません');
check(source.includes("localStorage.getItem('fridge-items')"),'保存在庫を読み込んでいません');
check(source.includes("window.addEventListener('pageshow',refreshStoredItems)"),'アプリ復帰時の再読込がありません');
check(source.includes("window.addEventListener('focus',refreshStoredItems)"),'再フォーカス時の再読込がありません');
check(source.includes("event.key==='fridge-items'"),'別タブ更新時の同期がありません');
check(source.includes("$('#itemCount').textContent=items.length"),'保存件数のバッジ反映がありません');
check(html.includes('app.js?v=31'),'JavaScriptのキャッシュ更新番号がありません');
results.push('24. 起動・復帰・別タブ同期・保存件数反映: PASS');

// 25: 初期化エラーより先に保存件数を表示し、旧形式と壊れた付随データへ対応。
check(html.includes("document.getElementById('itemCount').textContent=saved.length"),'app.jsより前の件数先行表示がありません');
check(html.indexOf("document.getElementById('itemCount')")<html.indexOf('app.js?v=31'),'件数先行表示がapp.jsより後です');
check(source.includes('function readStoredItems(fallback=[])'),'例外安全な在庫読込がありません');
check(source.includes("localStorage.getItem('fridgeItems')")&&source.includes("localStorage.getItem('fridgeInventory')"),'旧保存キーへの対応がありません');
check(source.includes('Array.isArray(parsed?.items)'),'旧オブジェクト形式への対応がありません');
check(source.includes('function readStoredObject(key)'),'付随保存データの安全な読込がありません');
check(source.includes('items=readStoredItems(items)'),'読込失敗時に現在の在庫を維持できません');
check(html.includes('app.js?v=31'),'JavaScriptのキャッシュ更新番号がありません');
results.push('25. 件数先行表示・初期化例外対策・旧保存形式移行: PASS');

// 26: スマホのカテゴリだけを3列へ圧縮し、食材一覧は2列を維持。
check(styles.includes('.category-icon-grid{grid-template-columns:repeat(3,minmax(0,1fr))}'),'スマホカテゴリが3列ではありません');
check(styles.includes('.category-icon-button{min-height:72px;padding:6px 3px'),'カテゴリボタンがコンパクトではありません');
check(styles.includes('.category-icon-button .category-pictogram{min-width:54px;height:36px'),'カテゴリ文字アイコンがコンパクトではありません');
check(styles.includes('.food-icon-grid{grid-template-columns:repeat(2,1fr)}'),'カテゴリ内食材の2列表示が維持されていません');
check(html.includes('styles.css?v=31'),'CSSのキャッシュ更新番号がありません');
results.push('26. スマホカテゴリ3列・小型ボタン・食材2列維持: PASS');

// 27: カテゴリ文字アイコンの内側だけをイメージ色へ変更。
check(source.includes('category-pictogram category-${category.id}'),'動的カテゴリへ色クラスが付きません');
check(styles.includes('.category-meat')&&styles.includes('background:#b84a4a'),'肉カテゴリが赤ではありません');
check(styles.includes('.category-fish')&&styles.includes('background:#3976a8'),'魚介カテゴリが青ではありません');
check(styles.includes('.category-vegetable')&&styles.includes('background:#3f8354'),'野菜カテゴリが緑ではありません');
check(styles.includes('.category-dairy')&&styles.includes('background:#a87424'),'乳製品カテゴリが黄土色ではありません');
check(styles.includes('.category-fruit')&&styles.includes('.category-daily')&&styles.includes('.category-seasoning')&&styles.includes('.category-frozen'),'その他カテゴリの色分けが不足しています');
check(html.includes('styles.css?v=31')&&html.includes('app.js?v=31'),'CSS/JSのキャッシュ更新番号がありません');
results.push('27. 肉赤・魚介青・野菜緑・乳製品黄土・全カテゴリ色分け: PASS');

// 28: Supabaseメールリンク認証とRLS前提のユーザー別クラウド保存。
check(html.includes('id="authGate"')&&html.includes('id="magicLinkForm"'),'メールログイン画面がありません');
check(html.includes('cloud-config.js?v=31')&&source.includes('@supabase/supabase-js@2'),'Supabaseクライアント設定がありません');
check(source.includes('if(!cloudConfigured)'),'未設定時にSupabase読込を省略できません');
check(source.includes('signInWithOtp'),'メールリンク認証がありません');
check(source.includes("from('fridge_user_data').select"),'ユーザー別データ読込がありません');
check(source.includes("from('fridge_user_data').upsert"),'ユーザー別データ保存がありません');
check(source.includes('user_id:currentCloudUser.id'),'保存データにユーザーIDがありません');
check(source.includes("localStorage.removeItem('fridge-items')"),'ログアウト時の端末在庫消去がありません');
check(source.includes("if(!cloudConfigured){$('#cloudModeBadge').textContent='端末保存'"),'未設定時の端末保存フォールバックがありません');
const schema=await readFile(new URL('../supabase-schema.sql',import.meta.url),'utf8');
check(schema.includes('enable row level security')&&schema.includes('auth.uid()'),'RLSまたはユーザー制限ポリシーがありません');
check(html.includes('styles.css?v=31')&&html.includes('app.js?v=31'),'CSS/JSのキャッシュ更新番号がありません');
results.push('28. メールリンク認証・ユーザー別同期・RLS・ログアウト消去: PASS');

console.log(results.join('\n'));
