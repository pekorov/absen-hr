// Employee-facing messages in Indonesian. The employee page sends x-lang: id (default) or en.
// English text stays the source; this turns it into Indonesian when asked.
const EXACT = {
  'Wrong name or PIN': 'Nama atau PIN salah',
  'Too late to undo. Ask your manager to fix the clock-out time.': 'Sudah terlambat untuk membatalkan. Minta manajer memperbaiki jam pulang.',
  'Location not detected. Turn on location and try again.': 'Lokasi tidak terdeteksi. Nyalakan lokasi lalu coba lagi.',
  'Location not detected.': 'Lokasi tidak terdeteksi.',
  'You already clocked in today.': 'Anda sudah absen masuk hari ini.',
  'No open clock-in found.': 'Tidak ada absen masuk yang masih terbuka.',
  'Not found': 'Tidak ditemukan',
  'Pick a day': 'Pilih hari',
  'Pick a colleague': 'Pilih rekan kerja',
  'You have no shift on that day.': 'Anda tidak punya shift di hari itu.',
  'You already have 5 open swap requests. Cancel one first.': 'Anda sudah punya 5 permintaan tukar shift yang belum selesai. Batalkan salah satu dulu.',
  'You already asked to swap that day.': 'Anda sudah meminta tukar shift untuk hari itu.',
  'Request not found': 'Permintaan tidak ditemukan',
  'This request can no longer be cancelled.': 'Permintaan ini sudah tidak bisa dibatalkan.',
  'This request is no longer waiting for you.': 'Permintaan ini sudah tidak menunggu jawaban Anda.',
  'Bad request': 'Permintaan tidak valid',
  'Pick a From and To date.': 'Pilih tanggal mulai dan selesai.',
  'Leave must start today or later.': 'Cuti harus mulai hari ini atau sesudahnya.',
  'Leave can be requested up to 4 months ahead.': 'Cuti bisa diminta paling lambat 4 bulan ke depan.',
  'One request can be at most 14 days.': 'Satu permintaan paling lama 14 hari.',
  'You already have 3 leave requests waiting.': 'Anda sudah punya 3 permintaan cuti yang menunggu.',
  'One of the two people is no longer active.': 'Salah satu dari kedua karyawan sudah tidak aktif.',
  'Pick a day within the next 31 days.': 'Pilih hari dalam 31 hari ke depan.',
  'The schedule changed since this request was made.': 'Jadwal sudah berubah sejak permintaan ini dibuat.',
  'That shift has already started.': 'Shift itu sudah dimulai.',
  'Scan the QR code on the counter tablet with your phone camera, then tap Clock in again.': 'Scan kode QR di tablet kasir dengan kamera HP, lalu tekan Absen Masuk lagi.',
  'Your work location is not set up. Please ask your manager.': 'Lokasi kerja Anda belum diatur. Silakan tanya manajer.',
  'Location not set': 'Lokasi belum diatur',
  'Any location': 'Semua lokasi',
};
const or = s => s.replace(/ or /g, ' atau ');
const PATTERNS = [
  [/^Your shift was closed automatically at (\S+)\. Ask HR if this is not correct\.$/, (m, a) => `Shift Anda ditutup otomatis pada ${a}. Hubungi HR jika ini tidak benar.`],
  [/^(.+) has no shift on that day\.$/, (m, a) => `${a} tidak punya shift di hari itu.`],
  [/^(.+) does not work at the same place\.$/, (m, a) => `${a} tidak bekerja di tempat yang sama.`],
  [/^Someone has already clocked in on (\S+)\.$/, (m, a) => `Ada yang sudah absen masuk pada ${a}.`],
  [/^Someone is on annual leave on (\S+)\.$/, (m, a) => `Ada yang sedang cuti tahunan pada ${a}.`],
  [/^(.+) already has a shift on (\S+)\.$/, (m, a, b) => `${a} sudah punya shift pada ${b}.`],
  [/^Unknown shift code (.+)\.$/, (m, a) => `Kode shift ${a} tidak dikenal.`],
  [/^Too late: swaps must be settled at least (\d+) hours before the shift starts\.$/, (m, a) => `Sudah terlambat: tukar shift harus selesai paling lambat ${a} jam sebelum shift dimulai.`],
  [/^You can only clock in at (.+)\. You are at (.+)\.$/, (m, a, b) => `Anda hanya bisa absen di ${or(a)}. Anda sedang di ${b}.`],
  [/^You are not at (.+) \(about (.+) from (.+)\)\. Go there to clock in\.$/, (m, a, b, c) => `Anda tidak berada di ${or(a)} (sekitar ${b} dari ${c}). Datang ke sana untuk absen.`],
  [/^You are not at a restaurant \(nearest: (.+), about (.+) away\)\. Go there to clock in\.$/, (m, a, b) => `Anda tidak berada di restoran (terdekat: ${a}, sekitar ${b}). Datang ke sana untuk absen.`],
];
export const toId = s => {
  if (typeof s !== 'string') return s;
  if (EXACT[s]) return EXACT[s];
  for (const [re, f] of PATTERNS) { const m = s.match(re); if (m) return f(...m); }
  return s;
};
export const langOf = req => (req.headers.get('x-lang') === 'id' ? 'id' : 'en'); // the employee page always sends it
export const say = (req, s) => (langOf(req) === 'id' ? toId(s) : s);
