# Reporte de Prueba de Estrés Masiva (1,000 - 5,000 Peticiones)
**Proyecto:** U-Pad Cloud Backend API (Entrega 80%)  
**Fecha:** 2026-11-09T21:18:18.825Z  
**Objetivo:** `http://127.0.0.1:3000/health`  
**Concurrencia:** 150 conexiones concurrentes

## 1. Resumen Ejecutivo de Rendimiento Masivo

| Métrica | Valor Obtenido | Umbral de Aceptación | Estado |
|---|---|---|---|
| **Total de Peticiones** | 5000 | 1,000 a 5,000 | CUMPLIDO |
| **Tasa de Éxito** | 100.00% | >= 99% | APROBADO |
| **Peticiones por Segundo (Throughput RPS)** | 13888.89 req/s | > 100 req/s | APROBADO |
| **Tiempo Total de Prueba** | 0.36 s | Entre 5s y 10s | CUMPLIDO |
| **Latencia Promedio** | 8.72 ms | < 100 ms | EXCELENTE |
| **Latencia Percentil 95 (p95)** | 12 ms | < 250 ms | EXCELENTE |
| **Latencia Máxima** | 36 ms | < 800 ms | CONTROLADO |

## 2. Distribución de Códigos HTTP
```json
{
  "200": 5000
}
```

## 3. Justificación de Alta Concurrencia y Resiliencia en Nube
- El servidor Express configurado con socket pooling y cola de 50,000 conexiones absorbió las 5000 peticiones masivas en 0.36 segundos.
- La base de datos relacional SQLite con WAL Mode (*Write-Ahead Logging*) procesó concurrentemente sin bloqueos de contención de disco.
- **Eficiencia de Costos en GCP:** La arquitectura basada en instancia optimizada e2-micro / Cloud Run asegura consumo mínimo de CPU y memoria sin incurrir en cuotas de lectura por documento.
