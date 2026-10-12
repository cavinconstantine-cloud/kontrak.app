// Bangun versi web (satu file HTML) dari tampilan bersama + adapter artifact:
//   node web/build.js  →  web/buku-proyek-web.html
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(R, 'public/style.css'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, 'api-artifact.js'), 'utf8');
const kon = fs.readFileSync(path.join(R, 'public/konsultan.js'), 'utf8');
const app = fs.readFileSync(path.join(R, 'public/app.js'), 'utf8');
const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Buku Proyek</title>
<meta name="description" content="Aplikasi pembukuan proyek kontraktor: Owner, Admin-Finance, Mandor — versi web">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${css}
</style>
</head>
<body>
<div id="app"><div class="center muted">Memuat Buku Proyek…</div></div>
<div id="toast" class="toast" hidden></div>
<script>
${api.replace(/<\/script/gi, '<\\/script')}
</script>
<script>
${kon.replace(/<\/script/gi, '<\\/script')}
</script>
<script>
${app.replace(/<\/script/gi, '<\\/script')}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'buku-proyek-web.html'), html);
console.log('web/buku-proyek-web.html', html.length, 'bytes');
