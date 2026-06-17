# ClaudeCron

Command-line tool untuk membuka Claude.ai dan mengirim pesan `hi`.

## Run

```bash
npm install
npm run login
npm start
```

Gunakan `npm run login` sekali untuk login Claude di profile browser khusus tool ini. Untuk Task Scheduler Claude CLI, edit `claudecron.config.json`.

## Task Scheduler

```cmd
npm run install-task
```

Pastikan `claude -p "hi"` sudah jalan di PowerShell sebelum install task. Task ini membaca `claudecron.config.json`, menjalankan `claude -p`, hidden, wake dari sleep jika wake timer Windows aktif, dan tetap berjalan saat PC terkunci. Jadwal di config sekarang mengikuti Rabu-Kamis 08:30/13:30/18:30/23:30 WIB dan Jumat-Selasa 04:30/09:30/14:30/19:30 WIB.
