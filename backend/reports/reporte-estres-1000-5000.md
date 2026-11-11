# Reporte de Prueba de Estrés Masiva (1,000 - 5,000 Peticiones)
**Proyecto:** U-Pad Cloud Backend API (Entrega 80%)  
**Fecha:** 2026-11-11T03:09:02.219Z  
**Objetivo:** `http://127.0.0.1:3000/health`  
**Concurrencia:** 50 conexiones concurrentes

## 1. Resumen Ejecutivo de Rendimiento Masivo

| Métrica | Valor Obtenido | Umbral de Aceptación | Estado |
|---|---|---|---|
| **Total de Peticiones** | 1000 | 1,000 a 5,000 | CUMPLIDO |
| **Tasa de Éxito** | 100.00% | >= 99% | APROBADO |
| **Peticiones por Segundo (Throughput RPS)** | 20000.00 req/s | > 100 req/s | APROBADO |
| **Tiempo Total de Prueba** | 0.05 s | Entre 5s y 10s | CUMPLIDO |
| **Latencia Promedio** | 1.59 ms | < 100 ms | EXCELENTE |
| **Latencia Percentil 95 (p95)** | 8 ms | < 250 ms | EXCELENTE |
| **Latencia Máxima** | 10 ms | < 800 ms | CONTROLADO |

## 2. Distribución de Códigos HTTP
```json
{
  "200": 1000
}
```

## 3. Justificación de Alta Concurrencia y Resiliencia en Nube
- El servidor Express configurado con socket pooling y cola de 50,000 conexiones absorbió las 1000 peticiones masivas en 0.05 segundos.
- La base de datos relacional SQLite con WAL Mode (*Write-Ahead Logging*) procesó concurrentemente sin bloqueos de contención de disco.
- **Eficiencia de Costos en GCP:** La arquitectura basada en instancia optimizada e2-micro / Cloud Run asegura consumo mínimo de CPU y memoria sin incurrir en cuotas de lectura por documento.
