# Кнопка «Перекласти» (Cloudflare Worker)

1. dash.cloudflare.com → Workers & Pages → Create → Worker → назва `ua-legion-translate` → Deploy → Edit code → вставити весь вміст `worker/worker.js` → Deploy.
2. Worker → Settings → Variables: `DISCORD_PUBLIC_KEY` (Discord Developer Portal → твій застосунок → General Information → Public Key) і `DISCORD_APP_ID` (там само, Application ID). Save/Deploy.
3. Developer Portal → General Information → **Interactions Endpoint URL** = адреса воркера (`https://ua-legion-translate.<акаунт>.workers.dev`) → Save (Discord надішле перевірочний запит; має зберегтись без помилок).
4. GitHub репозиторій → Settings → Secrets and variables → Actions → Variables → `TRANSLATE_BUTTON` = `1`.

`worker/worker.js` зібрано з `worker/worker-src.js` командою `npx esbuild worker/worker-src.js --bundle --format=esm --outfile=worker/worker.js`.
