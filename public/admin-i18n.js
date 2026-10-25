// Admin page language: English by default, Indonesian with the ID switch (remembered in this browser).
// The page is written in English; when Indonesian is on, every text on screen is looked up here and replaced.
// The payslip itself is always Indonesian (see slip-pdf.js).
let ALANG = (() => { try { return localStorage.getItem('alang') === 'id' ? 'id' : 'en'; } catch (e) { return 'en'; } })();
const ALOC = () => (ALANG === 'id' ? 'id-ID' : 'en-GB');

const AID = {
// sign in, header, tabs
'Absen admin': 'Admin Absen', 'Sign in': 'Masuk', 'Sign out': 'Keluar', 'Username': 'Nama pengguna', 'Password': 'Kata sandi', '(empty for owner)': '(kosongkan untuk pemilik)',
'Owner: leave the username empty and use the owner password. HR and managers: use your own username.': 'Pemilik: kosongkan nama pengguna dan pakai kata sandi pemilik. HR dan manajer: pakai nama pengguna masing-masing.',
'Review': 'Review', 'Today': 'Hari ini', 'Schedule': 'Jadwal', 'Payroll': 'Penggajian', 'Setup': 'Pengaturan', 'Loading…': 'Memuat…',
'Owner': 'Pemilik', 'HR': 'HR', 'Manager': 'Manajer', 'Could not sign in': 'Gagal masuk', 'Signed out.': 'Sudah keluar.',
'Your sign-in ended. Please sign in again.': 'Sesi Anda berakhir. Silakan masuk lagi.',
'Signed out after 5 hours without activity. Please sign in again.': 'Keluar otomatis setelah 5 jam tidak aktif. Silakan masuk lagi.',
'Wrong username or password': 'Nama pengguna atau kata sandi salah', 'Too many wrong tries. Wait 15 minutes and try again.': 'Terlalu banyak percobaan salah. Tunggu 15 menit lalu coba lagi.',
'Please sign in again': 'Silakan masuk lagi', 'Your admin login is not allowed to do this. Ask the owner.': 'Akun admin Anda tidak boleh melakukan ini. Tanyakan ke pemilik.',
// review
'Shift swaps': 'Tukar shift', 'Both employees have agreed to these. Approving changes the schedule; pay and late checks follow the new schedule.': 'Kedua karyawan sudah setuju. Jika disetujui, jadwal berubah; gaji dan cek keterlambatan mengikuti jadwal baru.',
'Approve': 'Setujui', 'Reject': 'Tolak', 'No swaps waiting for approval.': 'Tidak ada tukar shift yang menunggu persetujuan.', 'Waiting for the colleague': 'Menunggu rekan kerja',
'Recent swap decisions': 'Keputusan tukar shift terakhir', 'Leave requests': 'Permintaan cuti', 'Approve (paid leave)': 'Setujui (cuti dibayar)', 'No leave requests waiting.': 'Tidak ada permintaan cuti yang menunggu.',
'Recent leave decisions': 'Keputusan cuti terakhir', 'Clock-ins to check': 'Absen yang perlu dicek',
"Compare the selfie with the person's first photo (saved automatically from their first clock-in). Rejected clock-ins count as absent.": 'Bandingkan selfie dengan foto pertama karyawan (tersimpan otomatis dari absen pertamanya). Absen yang ditolak dihitung tidak masuk.',
'First photo (profile)': 'Foto pertama (profil)', 'No profile photo yet': 'Belum ada foto profil', 'Replace profile photo with this selfie': 'Ganti foto profil dengan selfie ini',
'Clock-out time (optional)': 'Jam pulang (opsional)', 'Nothing to check.': 'Tidak ada yang perlu dicek.',
'Needs your approval': 'Perlu persetujuan Anda', 'Waiting for colleague': 'Menunggu rekan', 'Approved': 'Disetujui', 'Declined by colleague': 'Ditolak rekan', 'Rejected': 'Ditolak', 'Cancelled': 'Dibatalkan', 'Expired': 'Kedaluwarsa',
'Outside the restaurant area': 'Di luar area restoran', 'Low GPS accuracy': 'GPS kurang akurat', 'Impossible travel': 'Perpindahan tidak wajar', 'Location blocked': 'Lokasi diblokir', 'No selfie': 'Tanpa selfie',
'No shift scheduled': 'Tidak ada shift terjadwal', 'Missed clock-out': 'Lupa absen pulang', 'Auto clock-out': 'Pulang otomatis', 'QR code not scanned (beta)': 'Kode QR tidak di-scan (beta)', 'Clocked out early': 'Pulang lebih awal', 'Same photo sent before': 'Foto yang sama pernah dikirim', 'Looks the same as an earlier selfie': 'Terlihat sama dengan selfie sebelumnya', "Looks the same as another person's selfie today": 'Terlihat sama dengan selfie orang lain hari ini',
'Same photo': 'Foto sama', 'Look-alike': 'Mirip', 'Photo no longer stored': 'Foto sudah tidak tersimpan', 'Photos': 'Foto', 'No selfies stored in the last 60 days.': 'Tidak ada selfie tersimpan dalam 60 hari terakhir.',
'First photo (kept permanently) and every clock-in selfie from the last 60 days. Tap a photo to enlarge it.': 'Foto pertama (disimpan permanen) dan semua selfie absen dalam 60 hari terakhir. Ketuk foto untuk memperbesar.',
// today
'Attendance': 'Kehadiran', 'Name': 'Nama', 'Place': 'Tempat', 'Shift': 'Shift', 'In': 'Masuk', 'Out': 'Pulang', 'Worked': 'Lama kerja', 'After shift end': 'Setelah shift selesai', 'Late': 'Terlambat', 'Status': 'Status',
'Set': 'Ubah', 'not yet': 'belum', 'no clock-out': 'tidak absen pulang', '(auto)': '(otomatis)', 'ok': 'ok', 'approved': 'disetujui', 'review': 'review', 'rejected': 'ditolak',
// schedule + leave
'Import weekly schedule': 'Impor jadwal mingguan',
'Excel (.xlsx) or CSV. Column A = Name, B = PIN (leave a PIN cell empty to keep that person\'s current PIN). Optional columns: "Phone" (WhatsApp number), "Login name" (what the person types to sign in), "Location" (a restaurant name from Setup, several names separated by a comma, or ALL). Then one column per date with a shift code (OFF for days off). For a double shift write both codes with a +, for example M + Md. See schedule-template.csv.':
 'Excel (.xlsx) atau CSV. Kolom A = Nama, B = PIN (kosongkan sel PIN untuk tetap memakai PIN lama). Kolom opsional: "Phone" (nomor WhatsApp), "Login name" (nama yang diketik untuk masuk), "Location" (nama restoran dari Pengaturan, beberapa nama dipisah koma, atau ALL). Lalu satu kolom per tanggal berisi kode shift (OFF untuk libur). Untuk shift ganda tulis kedua kode dengan +, misal M + Md. Lihat schedule-template.csv.',
'Import': 'Impor', 'Annual leave (paid)': 'Cuti tahunan (dibayar)',
"Add leave directly here, or approve employees' requests in Review. A leave day keeps the scheduled shift but is paid as normal.": 'Tambahkan cuti langsung di sini, atau setujui permintaan karyawan di Review. Hari cuti tetap memakai shift terjadwal dan dibayar seperti biasa.',
'Employee': 'Karyawan', 'From': 'Dari', 'To': 'Sampai', 'Add leave': 'Tambah cuti', 'Showing month': 'Menampilkan bulan', 'Date': 'Tanggal', 'Remove': 'Hapus', 'No leave this month.': 'Tidak ada cuti bulan ini.',
'Fix the file and choose it again.': 'Perbaiki file lalu pilih lagi.', 'Login name': 'Nama login', 'Location': 'Lokasi', 'WhatsApp': 'WhatsApp',
// payroll
'Monthly payslips': 'Slip gaji bulanan',
'Every payslip starts as a Draft. Check it with View, tick the people and press Verify. Only verified payslips can be downloaded or sent on WhatsApp. If something changes later (overtime, kasbon, leave, an attendance fix), the payslip shows Changed and must be verified again. People with clock-ins still in Review cannot be verified.':
 'Setiap slip gaji dimulai sebagai Draf. Cek dengan Lihat, centang karyawan lalu tekan Verifikasi. Hanya slip yang sudah diverifikasi yang bisa diunduh atau dikirim lewat WhatsApp. Jika ada perubahan (lembur, kasbon, cuti, perbaikan absen), slip menjadi Berubah dan harus diverifikasi lagi. Karyawan yang absennya masih di Review belum bisa diverifikasi.',
'Download Excel (attendance + payroll)': 'Unduh Excel (kehadiran + gaji)', 'Pay': 'Gaji', 'Hours': 'Jam', 'Overtime': 'Lembur', 'Kasbon': 'Kasbon', 'Take-home': 'Gaji bersih', 'View': 'Lihat',
'Verify selected': 'Verifikasi yang dipilih', 'Un-verify selected': 'Batalkan verifikasi', 'Tick all': 'Centang semua', 'Verified': 'Terverifikasi', 'Draft': 'Draf', 'Changed · verify again': 'Berubah · verifikasi lagi',
'No pay rate yet': 'Belum ada tarif gaji', 'Paid weekly: use Period payslips below': 'Dibayar mingguan: pakai Slip gaji periode di bawah', 'No schedule this month': 'Tidak ada jadwal bulan ini',
'No scheduled shifts in this period': 'Tidak ada shift terjadwal di periode ini', 'Monthly pay: choose dates inside one month': 'Gaji bulanan: pilih tanggal dalam satu bulan',
'This month has not finished yet, so this is a preview. Verify after the month ends, or use Period payslips for pay up to today.': 'Bulan ini belum selesai, jadi ini hanya pratinjau. Verifikasi setelah bulan berakhir, atau pakai Slip gaji periode untuk gaji sampai hari ini.',
'Period payslips (weekly, or up to today)': 'Slip gaji periode (mingguan, atau sampai hari ini)',
'For staff paid weekly, or to see pay for the month so far. Days after today are ignored. Monthly-paid staff can be included when the dates stay inside one month. Same rule: verify before sending.':
 'Untuk karyawan yang dibayar mingguan, atau melihat gaji bulan ini sampai sekarang. Hari setelah hari ini tidak dihitung. Karyawan bulanan bisa disertakan jika tanggalnya dalam satu bulan. Aturannya sama: verifikasi sebelum dikirim.',
'Weekly-paid staff are ticked automatically.': 'Karyawan mingguan otomatis dicentang.', 'monthly': 'bulanan', 'hourly': 'per jam', 'daily': 'harian', 'weekly': 'mingguan',
'Added by HR only. Pay = hours × the overtime rate. The Today tab shows how long after the shift end someone clocked out, as a hint.': 'Hanya ditambahkan oleh HR. Bayaran = jam × tarif lembur. Tab Hari ini menunjukkan berapa lama setelah shift selesai seseorang absen pulang, sebagai petunjuk.',
'Hours, e.g. 2.5': 'Jam, misal 2,5', 'Note (optional)': 'Catatan (opsional)', 'Add overtime': 'Tambah lembur', 'Amount': 'Jumlah', 'Delete': 'Hapus', 'No overtime this month.': 'Tidak ada lembur bulan ini.',
'Rate per hour (Rp)': 'Tarif per jam (Rp)', 'Save rate': 'Simpan tarif', 'Kasbon (cash advance)': 'Kasbon',
'Taken off the payslip that includes its date. It never takes pay below zero; anything left over is shown as a warning so you can add it again next period.': 'Dipotong dari slip gaji yang mencakup tanggalnya. Gaji tidak akan jadi minus; sisanya muncul sebagai peringatan agar bisa ditambahkan lagi di periode berikutnya.',
'Amount (Rp), e.g. 200000': 'Jumlah (Rp), misal 200000', 'Add kasbon': 'Tambah kasbon', 'No kasbon this month.': 'Tidak ada kasbon bulan ini.', 'Delete this kasbon?': 'Hapus kasbon ini?',
'Salary data': 'Data gaji',
'Excel or CSV with columns: Name, Pay type (Monthly, Daily or Hourly), Rate, and Paid (Weekly or Monthly, optional). Monthly: the monthly salary. Daily (Harian): the pay for one day worked, any shift length. Hourly: the pay per hour. Weekly-paid staff get payslips from Period payslips. See salary-template.csv.':
 'Excel atau CSV dengan kolom: Name, Pay type (Monthly, Daily atau Hourly), Rate, dan Paid (Weekly atau Monthly, opsional). Monthly: gaji per bulan. Daily (Harian): bayaran per hari kerja, berapa pun lama shiftnya. Hourly: bayaran per jam. Karyawan mingguan mendapat slip dari Slip gaji periode. Lihat salary-template.csv.',
'Pay type': 'Jenis gaji', 'Rate': 'Tarif', 'Paid': 'Dibayar', 'Import salary data': 'Impor data gaji',
'Late deduction and work hours': 'Potongan terlambat dan jam kerja', 'Max paid hours per day': 'Maksimal jam dibayar per hari',
'A longer shift is paid only up to this many hours (hourly and monthly pay). Anything more is paid only as overtime that you add. Daily pay is always one full day.': 'Shift yang lebih panjang hanya dibayar sampai jumlah jam ini (gaji per jam dan bulanan). Kelebihannya hanya dibayar sebagai lembur yang Anda tambahkan. Gaji harian selalu dihitung satu hari penuh.',
'Late deduction': 'Potongan terlambat', 'Deducted for each late clock-in, by minutes after the shift starts.': 'Dipotong untuk setiap keterlambatan, dihitung dari menit setelah shift dimulai.',
'Deduct for late clock-ins': 'Potong gaji jika terlambat', 'Tolerance in minutes': 'Toleransi (menit)', 'Level 1 deduction (Rp)': 'Potongan tingkat 1 (Rp)', 'Level 2 from (minutes)': 'Tingkat 2 mulai (menit)',
'Level 2 deduction (Rp)': 'Potongan tingkat 2 (Rp)', 'Level 3 from (minutes)': 'Tingkat 3 mulai (menit)', 'Level 3 deduction (Rp)': 'Potongan tingkat 3 (Rp)', 'Save rules': 'Simpan aturan',
'WhatsApp message (free, one tap)': 'Pesan WhatsApp (gratis, sekali tekan)',
"Used when you press WhatsApp on a verified payslip. Use {name}, {period} and {link}. {link} is the person's private payslip link: it opens their payslip with a Download PDF button and stops working after 45 days, or as soon as you un-verify the payslip or it changes. If you leave {link} out, it is added at the end. Do not put salary amounts in the message.":
 'Dipakai saat Anda menekan WhatsApp pada slip yang sudah diverifikasi. Pakai {name}, {period} dan {link}. {link} adalah link pribadi slip gaji karyawan: membuka slip dengan tombol Unduh PDF dan tidak berlaku setelah 45 hari, atau langsung saat verifikasi dibatalkan atau slip berubah. Jika {link} tidak ditulis, link ditambahkan di akhir. Jangan menulis jumlah gaji di pesan.',
'Save message': 'Simpan pesan', 'Saved.': 'Tersimpan.', 'Removed.': 'Dihapus.', 'Restored.': 'Dipulihkan.', 'Deleted permanently.': 'Dihapus permanen.', 'Tick at least one person.': 'Centang minimal satu orang.',
'no WhatsApp number': 'tidak ada nomor WhatsApp', 'verify again to make a link': 'verifikasi lagi untuk membuat link', 'Sent ✓': 'Terkirim ✓', 'Download PDF': 'Unduh PDF', 'Share PDF': 'Bagikan PDF', 'Copy link': 'Salin link', 'Close': 'Tutup', 'Copied': 'Tersalin',
'Changed since verified · draft': 'Berubah sejak diverifikasi · draf', 'Draft · not verified': 'Draf · belum diverifikasi',
'Tick this person and press Verify in the Payroll tab before sending. Only verified payslips can be downloaded or sent.': 'Centang karyawan ini dan tekan Verifikasi di tab Penggajian sebelum dikirim. Hanya slip terverifikasi yang bisa diunduh atau dikirim.',
'This payslip was verified before private links existed. Un-verify and verify it again to make a link.': 'Slip ini diverifikasi sebelum ada link pribadi. Batalkan verifikasi lalu verifikasi lagi untuk membuat link.',
'Could not open the share sheet. Use Download PDF instead.': 'Menu bagikan tidak bisa dibuka. Pakai Unduh PDF saja.',
'Copy this link:': 'Salin link ini:',
// setup
'Shift codes': 'Kode shift', 'One per line: code,start,end. OFF is built in.': 'Satu per baris: kode,mulai,selesai. OFF sudah tersedia.', 'Restaurant locations': 'Lokasi restoran',
'Stand inside each restaurant and press "Use my current location". Don\'t rename a location after assigning staff to it.': 'Berdiri di dalam setiap restoran lalu tekan "Pakai lokasi saya sekarang". Jangan ganti nama lokasi setelah karyawan ditugaskan ke sana.',
'Latitude': 'Lintang', 'Longitude': 'Bujur', 'Allowed radius (metres)': 'Radius yang diizinkan (meter)', 'Counter QR code (beta)': 'Kode QR kasir (beta)', 'Off': 'Mati',
'Test: clock-in without QR goes to Review': 'Uji coba: absen tanpa QR masuk ke Review', 'On: QR required to clock in': 'Nyala: wajib scan QR untuk absen',
'Open this link on the counter tablet (keep it private):': 'Buka link ini di tablet kasir (jangan disebarkan):', 'Copy': 'Salin', 'Make a new kiosk link when I save (the old link stops working)': 'Buat link kiosk baru saat disimpan (link lama tidak berlaku)',
'Use my current location': 'Pakai lokasi saya sekarang', 'e.g. Cabang A': 'misal: Cabang A', '+ Add location': '+ Tambah lokasi', 'Save shift codes and locations': 'Simpan kode shift dan lokasi',
'Location is blocked in this browser.': 'Lokasi diblokir di browser ini.',
'Shift swap rules': 'Aturan tukar shift', 'Employees can swap shifts with a colleague from the same restaurant. The colleague must accept first.': 'Karyawan bisa tukar shift dengan rekan dari restoran yang sama. Rekan harus setuju dulu.',
'A manager must approve swaps after both agree': 'Manajer harus menyetujui setelah keduanya setuju', 'Swaps close this many hours before the shift starts': 'Tukar shift ditutup sekian jam sebelum shift dimulai', 'Save swap rules': 'Simpan aturan tukar shift',
'Admin accounts': 'Akun admin',
'Give each HR person or manager their own login, so the activity log shows who did what. HR can do everything except manage admins. Manager can use Review, Today and Schedule only (no pay). You (owner) sign in with an empty username and the owner password.':
 'Beri setiap HR atau manajer akun sendiri, agar catatan aktivitas menunjukkan siapa melakukan apa. HR bisa melakukan semuanya kecuali mengatur admin. Manajer hanya bisa memakai Review, Hari ini dan Jadwal (tanpa gaji). Anda (pemilik) masuk dengan nama pengguna kosong dan kata sandi pemilik.',
'Role': 'Peran', 'Edit': 'Ubah', 'No admin accounts yet.': 'Belum ada akun admin.', 'Add an admin': 'Tambah admin', 'Password (at least 8 characters)': 'Kata sandi (minimal 8 karakter)', 'Disabled (cannot sign in)': 'Nonaktif (tidak bisa masuk)', 'Save admin': 'Simpan admin', 'disabled': 'nonaktif',
'Employees': 'Karyawan',
'PIN: set a new PIN (this also unlocks someone after 5 wrong tries). PINs are stored scrambled, so nobody can read them, not even admins. Remove: the person can no longer sign in; history is kept and you can restore them. Delete permanently erases everything and cannot be undone.':
 'PIN: buat PIN baru (sekaligus membuka akun yang terkunci setelah 5 kali salah). PIN disimpan teracak, jadi tidak ada yang bisa membacanya, termasuk admin. Hapus: karyawan tidak bisa masuk lagi; riwayat tetap disimpan dan bisa dipulihkan. Hapus permanen menghapus semuanya dan tidak bisa dibatalkan.',
'Payroll name': 'Nama di slip gaji', 'Login': 'Login', 'Phone': 'Telepon', 'PIN': 'PIN', 'No employees yet.': 'Belum ada karyawan.', 'Removed employees': 'Karyawan yang dihapus', 'Restore': 'Pulihkan', 'Delete permanently': 'Hapus permanen', 'Any': 'Semua',
'New PIN saved. Tell the person their new PIN.': 'PIN baru tersimpan. Beri tahu karyawan PIN barunya.',
'Activity log': 'Catatan aktivitas', 'The last 200 changes and sign-ins, newest first. Failed sign-ins appear here too.': '200 perubahan dan login terakhir, terbaru di atas. Login yang gagal juga tercatat di sini.',
'When': 'Waktu', 'Who': 'Siapa', 'What': 'Apa', 'Details': 'Detail', 'Nothing yet.': 'Belum ada.', 'system': 'sistem',
// activity log actions
'Signed in': 'Masuk', 'Failed admin sign-in': 'Login admin gagal', 'Saved setup': 'Menyimpan pengaturan', 'Imported schedule': 'Impor jadwal', 'Imported salary data': 'Impor data gaji',
'Approved clock-in': 'Menyetujui absen', 'Rejected clock-in': 'Menolak absen', 'Set profile photo': 'Mengatur foto profil', 'Set clock-out': 'Mengubah jam pulang', 'Added leave': 'Menambah cuti', 'Removed leave': 'Menghapus cuti',
'Added overtime': 'Menambah lembur', 'Deleted overtime': 'Menghapus lembur', 'Added kasbon': 'Menambah kasbon', 'Deleted kasbon': 'Menghapus kasbon', 'Changed pay settings': 'Mengubah pengaturan gaji',
'Verified payslips': 'Memverifikasi slip gaji', 'Un-verified payslips': 'Membatalkan verifikasi slip', 'Changed WhatsApp number': 'Mengubah nomor WhatsApp', 'Set new PIN': 'Membuat PIN baru',
'Removed employee': 'Menghapus karyawan', 'Restored employee': 'Memulihkan karyawan', 'Deleted employee permanently': 'Menghapus karyawan permanen', 'Added admin': 'Menambah admin', 'Changed admin': 'Mengubah admin', 'Removed admin': 'Menghapus admin',
'Asked for a shift swap': 'Meminta tukar shift', 'Accepted a shift swap': 'Menerima tukar shift', 'Accepted a shift swap (schedule changed)': 'Menerima tukar shift (jadwal berubah)', 'Declined a shift swap': 'Menolak tukar shift', 'Cancelled a shift swap': 'Membatalkan tukar shift',
'Approved shift swap': 'Menyetujui tukar shift', 'Rejected shift swap': 'Menolak tukar shift', 'Asked for annual leave': 'Meminta cuti tahunan', 'Cancelled a leave request': 'Membatalkan permintaan cuti',
'Approved leave request': 'Menyetujui permintaan cuti', 'Rejected leave request': 'Menolak permintaan cuti', 'Undid clock-out': 'Membatalkan absen pulang',
// server messages (admin)
'Bad decision': 'Keputusan tidak valid', 'Bad month': 'Bulan tidak valid', 'Bad request': 'Permintaan tidak valid', 'Employee not found': 'Karyawan tidak ditemukan', 'Enter a name': 'Isi nama',
'Enter the amount in Rupiah, e.g. 200000': 'Isi jumlah dalam Rupiah, misal 200000', 'Every location needs a name': 'Setiap lokasi harus punya nama', 'Hours must be between 0 and 24': 'Jam harus antara 0 dan 24',
'Leave can be at most 62 days at a time': 'Cuti paling lama 62 hari sekaligus', 'Max paid hours must be between 1 and 24': 'Maksimal jam dibayar harus antara 1 dan 24', 'No clock-in found for that person on that day': 'Tidak ada absen masuk untuk orang itu di hari itu',
'Not found': 'Tidak ditemukan', 'Password must be at least 8 characters': 'Kata sandi minimal 8 karakter', 'Pick a month': 'Pilih bulan', 'Pick a role': 'Pilih peran', 'Pick a username (letters and numbers), not "owner".': 'Pilih nama pengguna (huruf dan angka), bukan "owner".',
'Pick a valid From and To date': 'Pilih tanggal mulai dan selesai yang benar', 'Pick a valid From and To date.': 'Pilih tanggal mulai dan selesai yang benar.', 'Pick a valid date': 'Pilih tanggal yang benar', 'Set a password for the new admin': 'Buat kata sandi untuk admin baru',
'That WhatsApp number looks wrong. Use a number like 0812 3456 7890.': 'Nomor WhatsApp sepertinya salah. Pakai format seperti 0812 3456 7890.', 'That selfie is no longer stored.': 'Selfie itu sudah tidak tersimpan.',
'The PIN must be 4 digits.': 'PIN harus 4 angka.', 'The typed name does not match.': 'Nama yang diketik tidak cocok.', 'This leave request is not waiting.': 'Permintaan cuti ini tidak sedang menunggu.',
'This month has not finished yet. For pay up to today, use Period payslips.': 'Bulan ini belum selesai. Untuk gaji sampai hari ini, pakai Slip gaji periode.', 'This swap is not waiting for approval.': 'Tukar shift ini tidak sedang menunggu persetujuan.',
'Too many kasbon entries for this person this month': 'Terlalu banyak kasbon untuk orang ini bulan ini', 'Too many overtime entries for this person this month': 'Terlalu banyak lembur untuk orang ini bulan ini', 'Use a time like 16:00': 'Pakai format jam seperti 16:00',
'The end date cannot be in the future.': 'Tanggal akhir tidak boleh di masa depan.', 'A period can be at most 62 days.': 'Satu periode paling lama 62 hari.', 'Set up your shift codes first (Setup tab).': 'Atur kode shift dulu (tab Pengaturan).',
'One of the two people is no longer active.': 'Salah satu dari kedua karyawan sudah tidak aktif.', 'Pick a day within the next 31 days.': 'Pilih hari dalam 31 hari ke depan.', 'The schedule changed since this request was made.': 'Jadwal sudah berubah sejak permintaan ini dibuat.', 'That shift has already started.': 'Shift itu sudah dimulai.',
'Something went wrong:': 'Terjadi kesalahan:',
'Clock-out time (24-hour, for example 16:00)': 'Jam pulang (24 jam, misal 16:00)',
'{a} gives {c} on {d} to {b}': '{a} memberikan {c} pada {d} ke {b}', '{d}: {a} ({x}) and {b} ({y}) exchange shifts': '{d}: {a} ({x}) dan {b} ({y}) bertukar shift',
"{a} gives {x} on {d} to {b}, and takes {n}'s {y} on {e}": '{a} memberikan {x} pada {d} ke {b}, dan mengambil {y} milik {n} pada {e}',
'shift codes': 'kode shift', 'locations': 'lokasi', 'swap rules': 'aturan tukar shift',
};

const APAT = [
[/^Total \((\d+)\)$/, 'Total ($1)'], [/^(\d+) in Review$/, '$1 di Review'], [/^(\d+)\/(\d+) days$/, '$1/$2 hari'], [/^(\d+) min$/, '$1 menit'], [/^\+(\d+) min$/, '+$1 menit'],
[/^(\d+) min early$/, '$1 menit lebih awal'], [/^over (\S+) h$/, 'lebih dari $1 jam'], [/^(\d+)h (\d+)m$/, '$1j $2m'],
[/^(monthly|hourly|daily) · weekly$/, (m, a) => `${AID[a]} · mingguan`],
[/^Asked (.+) · accepted (.+)$/, 'Diminta $1 · diterima $2'], [/^Asked (.+)$/, 'Diminta $1'], [/^Waiting for (.+)$/, 'Menunggu $1'], [/^By (.+) · (.+)$/, 'Oleh $1 · $2'], [/^Tell (.+)$/, 'Kabari $1'],
[/^Selfie (\S+) (\S*)$/, 'Selfie $1 $2'], [/^(.+) · in (\S+)(.*)$/, (m, a, b, c) => `${a} · masuk ${b}${c.replace(' · out ', ' · pulang ')}`],
[/^Preview: (\d+) employees, (\d+) days$/, 'Pratinjau: $1 karyawan, $2 hari'], [/^Preview: (\d+) employees$/, 'Pratinjau: $1 karyawan'],
[/^Imported (\d+) employees, (\d+) shifts\.$/, 'Berhasil impor $1 karyawan, $2 shift.'], [/^Saved pay rates for (\d+) employees\.$/, 'Tarif gaji tersimpan untuk $1 karyawan.'],
[/^Added (\d+) day\(s\)\. (\d+) of them have a scheduled shift\.$/, 'Ditambahkan $1 hari. $2 di antaranya ada shift terjadwal.'],
[/^Verified (\d+) payslip\(s\)\.$/, '$1 slip gaji terverifikasi.'], [/^(\d+) payslip\(s\) back to Draft\.$/, '$1 slip gaji kembali menjadi Draf.'],
[/^Not verified: (.+)$/, (m, a) => 'Belum diverifikasi: ' + a.replace(/: clock-ins still in Review/g, ': absen masih di Review').replace(/: no payslip/g, ': tidak ada slip')],
[/^(\d+) clock-in\(s\) this month are still in Review\. Until you reject them they count as present\.$/, '$1 absen bulan ini masih di Review. Selama belum ditolak, dihitung masuk.'],
[/^Un-verify (\d+) payslip\(s\)\? They go back to Draft\.$/, 'Batalkan verifikasi $1 slip gaji? Slip kembali menjadi Draf.'],
[/^Remove admin (.+)\?$/, 'Hapus admin $1?'], [/^Edit (.+) \(leave password empty to keep it\)$/, 'Ubah $1 (kosongkan kata sandi untuk tetap memakai yang lama)'],
[/^New 4-digit PIN for (.+):$/, 'PIN baru 4 angka untuk $1:'],
[/^WhatsApp number for (.+) \(for example 0812 3456 7890\)\. Leave empty to remove it\.$/, 'Nomor WhatsApp untuk $1 (misal 0812 3456 7890). Kosongkan untuk menghapus.'],
[/^Remove (.+)\? They can no longer sign in and will leave schedules and payroll\. Their history is kept\.$/, 'Hapus $1? Karyawan tidak bisa masuk lagi dan keluar dari jadwal dan penggajian. Riwayatnya tetap disimpan.'],
[/^This permanently erases everything about (.+): attendance, photos, leave, overtime, kasbon and payslips\. It cannot be undone\.\n\nType their payroll name to confirm:$/, 'Ini menghapus permanen semua data $1: kehadiran, foto, cuti, lembur, kasbon dan slip gaji. Tidak bisa dibatalkan.\n\nKetik nama di slip gajinya untuk konfirmasi:'],
[/^WhatsApp sends the person a private link to this payslip \(works until (.+)\)\. They open it and tap Download PDF\.( Or tap Share PDF to send the file itself\.)?$/, (m, a, b) => `WhatsApp mengirim link pribadi slip ini ke karyawan (berlaku sampai ${a}). Mereka membukanya lalu menekan Unduh PDF.${b ? ' Atau tekan Bagikan PDF untuk mengirim filenya langsung.' : ''}`],
[/^(\d+) clock-in\(s\) still under review$/, '$1 absen masih di Review'], [/^(\d+) day\(s\) with an unknown shift code$/, '$1 hari dengan kode shift tidak dikenal'],
[/^Kasbon Rp (\S+) is more than the pay left and was not deducted$/, 'Kasbon Rp $1 melebihi sisa gaji dan tidak dipotong'],
[/^⚠ (.+)$/, (m, a) => '⚠ ' + a.replace(/(\d+) clock-in\(s\) still under review/g, '$1 absen masih di Review').replace(/(\d+) day\(s\) with an unknown shift code/g, '$1 hari dengan kode shift tidak dikenal').replace(/Kasbon Rp (\S+) is more than the pay left and was not deducted/g, 'Kasbon Rp $1 melebihi sisa gaji dan tidak dipotong')],
[/^(.+) is (\S+) hours: only (\S+) hours a day are paid; add the rest as overtime if you approve it\.$/, '$1 berdurasi $2 jam: hanya $3 jam per hari yang dibayar; tambahkan sisanya sebagai lembur jika Anda setujui.'],
[/^Column (\d+) header is not a date$/, 'Judul kolom $1 bukan tanggal'], [/^(.+) on (\S+): unknown code "(.*)"$/, '$1 pada $2: kode "$3" tidak dikenal'], [/^(.+) on (\S+): unknown shift code "(.*)"$/, '$1 pada $2: kode shift "$3" tidak dikenal'],
[/^(.+): unknown location "(.*)"$/, '$1: lokasi "$2" tidak dikenal'], [/^(.+): PIN must be 4 digits$/, '$1: PIN harus 4 angka'], [/^(.+): login name "(.*)" is already used by someone else$/, '$1: nama login "$2" sudah dipakai orang lain'],
[/^(.+): not found\. Import a schedule that includes this person first\.$/, '$1: tidak ditemukan. Impor jadwal yang berisi orang ini dulu.'], [/^(.+): pay type must be Monthly, Daily or Hourly$/, '$1: jenis gaji harus Monthly, Daily atau Hourly'],
[/^(.+): rate is empty$/, '$1: tarif kosong'], [/^(.+): the WhatsApp number looks wrong$/, '$1: nomor WhatsApp sepertinya salah'], [/^(.+): this person was removed\. Restore them in Setup first\.$/, '$1: orang ini sudah dihapus. Pulihkan dulu di Pengaturan.'],
[/^Row (\d+): name is empty$/, 'Baris $1: nama kosong'], [/^(.+): latitude and longitude must be numbers$/, '$1: lintang dan bujur harus berupa angka'], [/^Duplicate location name: (.+)$/, 'Nama lokasi ganda: $1'],
[/^Shift (.+): times must look like 07:00$/, 'Shift $1: jam harus seperti 07:00'], [/^Shift code "(.+)" appears twice \(capital letters do not make a different code\)\.$/, 'Kode shift "$1" muncul dua kali (huruf besar/kecil tidak membuat kode berbeda).'],
[/^Check the pay type \(Monthly, Daily or Hourly\) and rate for: (.+)$/, 'Cek jenis gaji (Monthly, Daily atau Hourly) dan tarif untuk: $1'],
[/^(.+) does not work at the same place\.$/, '$1 tidak bekerja di tempat yang sama.'], [/^Someone has already clocked in on (\S+)\.$/, 'Ada yang sudah absen masuk pada $1.'], [/^Someone is on annual leave on (\S+)\.$/, 'Ada yang sedang cuti pada $1.'],
[/^(.+) already has a shift on (\S+)\.$/, '$1 sudah punya shift pada $2.'], [/^Too late: swaps must be settled at least (\d+) hours before the shift starts\.$/, 'Sudah terlambat: tukar shift harus selesai paling lambat $1 jam sebelum shift dimulai.'],
[/^(.+) \(employee\)$/, '$1 (karyawan)'],
// activity log details
[/^(\S+) to (\S+) · (\d+) people$/, '$1 s/d $2 · $3 orang'], [/^(\S+) to (\S+) · (.+)$/, '$1 s/d $2 · $3'], [/^(\d{4}-\d\d) · (\d+) people$/, '$1 · $2 orang'],
[/^(\d+) people$/, '$1 orang'], [/^(\d+) people, (\d+) shifts$/, '$1 orang, $2 shift'],
[/^(shift codes|locations|swap rules)(, (shift codes|locations|swap rules))*$/, m => m.split(', ').map(x => AID[x] || x).join(', ')],
[/^(.+) gives (.+) on (\S+) to (.+?); (.+) gives (.+) on (\S+) to (.+)$/, '$1 memberikan $2 pada $3 ke $4; $5 memberikan $6 pada $7 ke $8'],
[/^(.+) \((.+)\) and (.+) \((.+)\) swap on (\S+)$/, '$1 ($2) dan $3 ($4) bertukar shift pada $5'], [/^(.+) gives (.+) on (\S+) to (.+)$/, '$1 memberikan $2 pada $3 ke $4'],
[/^(.+) · (\S+) · (\S+) h$/, '$1 · $2 · $3 jam'], [/^(\S+) · was (\S+)$/, '$1 · sebelumnya $2'],
[/^(.+) \((.+)\) · (HR|Manager)(.*)$/, (m, a, b, c, d) => `${a} (${b}) · ${c === 'Manager' ? 'Manajer' : 'HR'}${d.replace(' · disabled', ' · nonaktif').replace(' · new password', ' · kata sandi baru')}`],
];

function atr(s) {
  if (ALANG !== 'id' || typeof s !== 'string') return s;
  const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], core = s.trim();
  if (!core) return s;
  if (AID[core]) return lead + AID[core] + tail;
  for (const [re, to] of APAT) if (re.test(core)) return lead + core.replace(re, to) + tail;
  return s;
}

// Translate everything on screen, and anything the page adds later.
(function () {
  const SKIP = 'script,style,textarea,.ps-paper,.notr';
  const doText = n => {
    if (!n.parentElement || n.parentElement.closest(SKIP)) return;
    if (n.__en === undefined || (n.__shown !== n.nodeValue)) n.__en = n.nodeValue; // the page wrote new English text
    const v = ALANG === 'id' ? atr(n.__en) : n.__en;
    if (n.nodeValue !== v) n.nodeValue = v;
    n.__shown = n.nodeValue;
  };
  const doAttrs = el => {
    if (el.closest && el.closest('.ps-paper,.notr')) return;
    for (const a of ['placeholder', 'title', 'aria-label']) {
      if (!el.hasAttribute || !el.hasAttribute(a)) continue;
      const key = '__en_' + a, cur = el.getAttribute(a);
      if (el[key] === undefined || el['__shown_' + a] !== cur) el[key] = cur;
      const v = ALANG === 'id' ? atr(el[key]) : el[key];
      if (cur !== v) el.setAttribute(a, v);
      el['__shown_' + a] = v;
    }
  };
  const walk = root => {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doAttrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) n.nodeType === 3 ? doText(n) : doAttrs(n);
  };
  let busy = false;
  const mo = new MutationObserver(list => {
    if (busy) return; busy = true;
    try { for (const m of list) { if (m.type === 'characterData') doText(m.target); else if (m.type === 'attributes') doAttrs(m.target); else m.addedNodes.forEach(walk); } }
    finally { busy = false; }
  });
  const start = () => { walk(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.setAdminLang = l => {
    ALANG = l; try { localStorage.setItem('alang', l); } catch (e) {}
    document.documentElement.lang = l;
    busy = true; try { walk(document.body); } finally { busy = false; }
    document.querySelectorAll('[data-alang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.alang === ALANG));
  };
  // Popups (confirm / prompt / alert) are translated too.
  const c = window.confirm.bind(window), p = window.prompt.bind(window), a = window.alert.bind(window);
  window.confirm = m => c(atr(m)); window.prompt = (m, d) => p(atr(m), d); window.alert = m => a(atr(m));
})();
