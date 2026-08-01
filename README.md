# klipersid

klipersid adalah aplikasi lokal untuk mengubah video panjang menjadi klip vertikal 9:16. Pipeline mengunduh sumber, melakukan transkripsi lokal, menganalisis momen, merender klip bersubtitle, dan membuat aset pendukung untuk publikasi.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI, Python
- Transkripsi: faster-whisper / CTranslate2
- Analisis visual: OpenCV
- Video: FFmpeg dan yt-dlp

## Menjalankan secara lokal

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe run.py
```

### Frontend development

```powershell
cd frontend
npm ci
npm run dev
```

Frontend development tersedia di `http://127.0.0.1:5173` dan backend di `http://127.0.0.1:8000`.

### Build frontend untuk FastAPI

```powershell
cd frontend
npm ci
npm run typecheck
npm run build
```

Setelah build, jalankan backend dan buka `http://127.0.0.1:8000`.

## Data lokal

Folder `data/` tidak disimpan di Git karena dapat berisi video sumber, audio, klip hasil render, cache, log, dan model Whisper berukuran besar. Aplikasi akan membuat direktori runtime yang diperlukan ketika dijalankan.

## Branding

Logo aplikasi berada di `frontend/public/klipersid.svg`.

