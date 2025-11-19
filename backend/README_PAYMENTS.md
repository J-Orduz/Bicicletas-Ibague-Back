# Integración de Pagos — Documentación (SIS-22 / HU-21)

Este documento resume los endpoints, variables de entorno, flujos de prueba y consideraciones de seguridad que implementamos para la historia SIS-22 / HU-21.

## Resumen

- Modo soportado: `mock` (mock server) y `sandbox` (Stripe test).
- Endpoints principales creados en `backend`: `/api/payments/*`, `/api/config/*`.
- Event-bus: eventos de pago se publican en `CHANNELS.PAGOS` usando Upstash Redis.

---

## Variables de entorno importantes

Coloca estas variables en `backend/.env` (NO subir claves reales a Git):

- `PAYMENT_MODE` = `mock` | `sandbox` (default `sandbox`)
- `STRIPE_SECRET_KEY` = `sk_test_xxx` (solo para `sandbox`)
- `STRIPE_PUBLISHABLE_KEY` = `pk_test_xxx` (frontend usa esta key)
- `STRIPE_WEBHOOK_SECRET` = `whsec_xxx` (para validar webhooks de Stripe)
- `PAYMENT_MOCK_URL` = `http://localhost:8080` (endpoint del mock)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (para event-bus)

---

## Endpoints (contrato)

Base URL: `http://localhost:3000`

1. Health check

- GET `/health` — devuelve estado del servicio.

2. Crear PaymentIntent (backend crea PaymentIntent en Stripe o llama mock)

- POST `/api/payments/create-payment-intent`
- Headers: `Content-Type: application/json`
- Body:

```json
{
  "amount": 500,
  "currency": "usd",
  "metadata": { "bookingId": "abc123" }
}
```

- Response esperado (sandbox - Stripe):

```json
{ "paymentIntent": { "id": "pi_...", "client_secret": "pi_..._secret_...", "amount":500, ... } }
```

3. Webhook (Stripe o mock)

- POST `/api/payments/webhook`
- Nota: la ruta utiliza `express.raw({ type: 'application/json' })`.
  - En `sandbox` se espera la cabecera `stripe-signature` y la validación con `STRIPE_WEBHOOK_SECRET`.
  - En `mock` acepta JSON normal (útil para Postman/manual testing).

Payloads de ejemplo (modo mock):

- `payment_intent.succeeded`:

```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_mock_1",
      "amount": 500,
      "currency": "usd",
      "metadata": { "bookingId": "abc123" }
    }
  }
}
```

- `payment_intent.payment_failed`:

```json
{
  "type": "payment_intent.payment_failed",
  "data": {
    "object": {
      "id": "pi_mock_fail_1",
      "amount": 500,
      "currency": "usd",
      "metadata": { "bookingId": "abc123" },
      "last_payment_error": { "message": "Card declined" }
    }
  }
}
```

- `charge.refunded`:

```json
{
  "type": "charge.refunded",
  "data": {
    "object": {
      "id": "ch_mock_1",
      "amount": 500,
      "currency": "usd",
      "payment_intent": "pi_mock_1",
      "metadata": { "bookingId": "abc123" },
      "refunds": { "data": [{ "id": "re_mock_1", "amount": 500 }] }
    }
  }
}
```

4. Obtener PaymentIntent (para polling desde el front)

- GET `/api/payments/:id`
- Response: `{ "paymentIntent": { ... } }` — usa `paymentHandler.retrievePaymentIntent`.

5. Obtener publishable key para frontend

- GET `/api/config/stripe-pk` — response `{ "publishableKey": "pk_test_..." }`

---

## Event-bus (mapa de eventos)

- Canal: `CHANNELS.PAGOS` (valor: `pagos`)
- Eventos publicados desde `paymentController.webhookHandler`:
  - `PagoConfirmado` (al recibir `payment_intent.succeeded`)
    - payload.data: `{ paymentId, amount, currency, metadata, raw }`
  - `PagoFallido` (al recibir `payment_intent.payment_failed`)
    - payload.data: `{ paymentId, amount, currency, metadata, last_error, raw }`
  - Recomendado: `PagoReembolsado` al recibir `charge.refunded` (pendiente de implementación).

Los eventos se guardan en Upstash Redis con `lpush('channel:pagos', JSON.stringify(eventData))` y se notifica a subscribers locales.

---

## Cómo probar (rápido)

A) Usando Stripe CLI (modo sandbox, recomendado para pruebas reales con firma):

1. En un terminal, reenvía webhooks a tu servidor local:

```powershell
stripe listen --forward-to "http://localhost:3000/api/payments/webhook"
```

2. En otro terminal, dispara eventos:

```powershell
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded   # si está disponible
```

B) Usando Postman / curl (modo mock o para pruebas manuales sin firma):

POST a `http://localhost:3000/api/payments/webhook` con `Content-Type: application/json` y el payload de ejemplo en la sección Webhook.

C) Crear PaymentIntent desde front/backend:

```powershell
curl -X POST http://localhost:3000/api/payments/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{"amount":500,"currency":"usd","metadata":{"bookingId":"abc123"}}'
```

---

## Flujo recomendado para el Frontend

1. Front hace `GET /api/config/stripe-pk` para obtener `pk_test_...` y configura `Stripe.js`.
2. Front llama `POST /api/payments/create-payment-intent` con `{ amount, currency, metadata:{ bookingId } }` y obtiene `client_secret`.
3. Front llama `stripe.confirmCardPayment(client_secret, { payment_method: { card } })` (Stripe.js) para manejar 3DS y completar el pago.
4. Backend recibe webhook `payment_intent.succeeded` y publica `PagoConfirmado` al event-bus. `services/booking` debería consumir ese evento y marcar la reserva como pagada.
5. Front puede comprobar estado final con `GET /api/payments/:id` o con un endpoint de `booking` (`GET /api/booking/reserva/:id`) o mediante push/websocket.

---

## Seguridad y mejores prácticas

- Nunca enviar `STRIPE_SECRET_KEY` al frontend.
- Validar `stripe-signature` en `sandbox` (ya implementado).
- Para integrar con plataformas que exigen autorización (p.ej. Supabase Functions), usar un header específico `x-webhook-secret` en lugar de exponer `SERVICE_ROLE` en Stripe.
- Implementar idempotencia: guardar `event.id` o `paymentIntent.id` para evitar procesar duplicados.

---

## Logs y mensajes esperados (para debugging)

- Al crear PaymentIntent verás la respuesta de Stripe en el body del endpoint `create-payment-intent`.
- Al recibir webhooks deberías ver en la consola del servidor:
  - `Payment succeeded: <id>` y `📤 Intentando publicar en: pagos` y `✅ [pagos] Evento publicado: PagoConfirmado`.
  - Para mock: `Mock payment succeeded`.

---

## Próximos pasos recomendados (pendientes / opcionales)

- Implementar `PagoReembolsado` en el webhook handler (map `charge.refunded`).
- Implementar consumer en `services/booking` que escuche `CHANNELS.PAGOS` y marque reservas como pagadas/pendientes.
- Añadir idempotencia/dedupe (Upstash/Redis o DB) para webhooks.
- Generar `examples/payment.html` con Stripe.js + Elements como ejemplo para frontend.
- Crear colección Postman con requests preconfigurados (ya listados en este archivo) y subir al repo.
- Documentar en el README principal los pasos de despliegue y cómo añadir claves en entornos dev/staging.

---

Si quieres, puedo crear ahora la colección Postman y el ejemplo `examples/payment.html`, o implementar el consumer en `services/booking`. Dime cuál prefieres que haga siguiente.

---

Archivo generado automáticamente por el asistente para la tarea SIS-22 / HU-21.
