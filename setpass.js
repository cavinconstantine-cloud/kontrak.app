// Ganti password:  node setpass.js owner PasswordBaru
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const f = path.join(__dirname, 'data', 'config.json');
const [role, pw] = process.argv.slice(2);
if (!fs.existsSync(f)) { console.log('Jalankan server dulu sekali (node server.js) agar data/config.json terbentuk.'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(f, 'utf8'));
if (!cfg.users[role] || !pw || pw.length < 6) { console.log('Pakai: node setpass.js <owner|admin|mandor> <password minimal 6 karakter>'); process.exit(1); }
cfg.users[role].hash = crypto.createHash('sha256').update(cfg.salt + ':' + pw).digest('hex');
fs.writeFileSync(f, JSON.stringify(cfg, null, 2));
console.log('Password ' + role + ' diganti. Pengguna yang sedang masuk perlu login ulang setelah server dijalankan lagi.');
