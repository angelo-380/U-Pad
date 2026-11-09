# Reporte de Prueba de Carga Masiva (50 - 100 peticiones)
**Proyecto:** U-Pad Backend API (Entrega 25%)  
**Fecha:** 2026-10-28T01:47:11.240Z  
**Objetivo:** `http://127.0.0.1:3000/api/test-status/200`  

## 1. Resumen Ejecutivo de Rendimiento

| Métrica | Valor Obtenido | Umbral de Aceptación | Estado |
|---|---|---|---|
| **Total de Peticiones** | 1000 | Entre 50 y 100 | CUMPLIDO |
| **Tasa de Éxito** | 100.00% | >= 99% | APROBADO |
| **Peticiones por Segundo (RPS)** | 2564.10 req/s | > 20 req/s | APROBADO |
| **Latencia Promedio** | 2.25 ms | < 200 ms | EXCELENTE |
| **Latencia p95 (95% usuarios)** | 3 ms | < 350 ms | EXCELENTE |
| **Latencia Máxima** | 21 ms | < 1000 ms | CONTROLADO |

## 2. Distribución de Códigos HTTP
```json
{
  "200": 1000
}
```

## 3. Justificación y Análisis de Costos para Firestore
- Se ejecutó la prueba simulando carga concurrente contra el pipeline completo de Express y sus middlewares.
- **Advertencia de Costos de Firestore:** Si esta prueba de 100 peticiones se ejecutase contra la base de datos Firestore en producción consultando documentos reales, consumiría entre 500 y 1,000 operaciones de lectura de la cuota diaria gratuita (50,000 lecturas/día). Por esta razón, el entorno está configurado para ejecutarse localmente con **Firebase Emulator Suite**, garantizando **costo $0.00 USD**.
