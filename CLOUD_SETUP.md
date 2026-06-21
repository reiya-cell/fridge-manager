# ユーザー別クラウド保存の設定

このアプリは `Cloudflare Pages + Supabase` を使う準備ができています。設定値が空の間は従来どおり端末内保存で動きます。

## 1. Supabase

1. Supabaseでプロジェクトを作成します。
2. SQL Editorで `supabase-schema.sql` を実行します。
3. AuthenticationのURL Configurationに、現在のGitHub Pages URLと今後の独自ドメインをRedirect URLとして追加します。
4. Project SettingsのAPI画面からProject URLとanon/publishable keyを確認します。
5. `cloud-config.js` の `supabaseUrl` と `supabaseAnonKey` に設定します。

`service_role` keyは管理者専用です。ブラウザへ置かないでください。

## 2. 動作確認

1. ページを開き、メールアドレスを入力します。
2. 届いたログインリンクを同じブラウザで開きます。
3. 初回だけ、その端末にある在庫をログインユーザーへ移します。
4. ログアウトし、別のメールアドレスでログインして在庫が分離されることを確認します。

## 3. Cloudflare PagesとURL

1. Cloudflare DashboardのWorkers & PagesからGitHubリポジトリを接続します。
2. Framework presetはNone、Build commandは空欄、Output directoryは `/` にします。
3. PagesプロジェクトのCustom domainsから取得済みの独自ドメインを追加します。
4. 新URLをSupabase AuthenticationのSite URLとRedirect URLへ追加します。

独自ドメインを使う場合、ドメイン名の取得費用が別途かかる場合があります。
