# Docker Instructions

Questo progetto è configurato per essere eseguito con Docker.

## Prerequisiti
- Docker
- Docker Compose

## Come avviare

1. **Build e Start**:
   Esegui il seguente comando nella root del progetto:
   ```bash
   docker-compose up --build
   ```

2. **Accesso all'applicazione**:
   L'applicazione sarà disponibile su: http://localhost:3060

## Uploads Persistence
La cartella `uploads/` è mappata come volume, quindi i file caricati persisteranno anche se il container viene rimosso.

## Database Persistence
I dati di MongoDB sono salvati in un volume Docker nominato `mongo-data`.
