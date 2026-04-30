# Python 3.12 slim imajını kullan
FROM python:3.12-slim

# Çalışma dizinini ayarla
WORKDIR /app

# İşletim sistemi seviyesindeki bağımlılıkları yükle (gerekliyse)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Sadece requirements dosyasını kopyala (Docker cache'ini verimli kullanmak için)
COPY requirements.txt .

# Bağımlılıkları kur
RUN pip install --no-cache-dir -r requirements.txt

# Projenin geri kalan dosyalarını kopyala
COPY . .

# FastAPI portunu dışarı aç
EXPOSE 8000

# Uygulamayı başlat
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
