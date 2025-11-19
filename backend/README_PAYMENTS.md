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

# Validacion Tarjeta — Documentación (SIS-5 / HU-04)

---

**Paquete de handoff (archivos incluidos en el repo)**

- `backend/examples/payment.html` — ejemplo mínimo con Stripe Elements (client-side tokenization + confirm) para pruebas locales.
- `backend/mock/postman_collection.json` — colección Postman con requests listos: `validate-card` (token y PAN mock), `create-payment-intent`, `webhook`, `get paymentIntent`.

**Cómo usar los artefactos (rápido)**

1. Arrancar mock server (opcional, para pruebas sin Stripe):

```powershell
node backend/mock/mock-server.js
```

2. Arrancar backend (en otra terminal):

```powershell
# Si quieres solo modo mock temporal en la sesión
$env:PAYMENT_MODE = 'mock'; $env:PAYMENT_MOCK_URL = 'http://localhost:8080'; node backend/server.js
# O si tienes .env configurado con STRIPE_* para sandbox
node backend/server.js
```

3. Importa `backend/mock/postman_collection.json` en Postman y ajusta `http://localhost:3000` como base.

4. Abrir `backend/examples/payment.html` en un navegador (sirve desde el servidor o abriéndolo localmente) para probar el flujo con Stripe Elements. Si lo sirves desde el servidor, coloca el archivo en un static host o abre directamente con Live Server.

**Notas rápidas para el frontend**

- Usar `GET /api/config/stripe-pk` para obtener `STRIPE_PUBLISHABLE_KEY`.
- Flujo preferido: `create-payment-intent` → `stripe.confirmCardPayment(client_secret, { payment_method: { card } })`.
- Para pruebas rápidas sin frontend: usa `POST /api/payments/validate-card` enviando `token: "tok_visa"` en el body.

### Endpoints adicionales (implementados en esta rama)

- POST `/api/payments/validate-card`
  - Propósito: Validar una tarjeta o tokenizar/validar un `token` recibido desde el cliente.
  - Body admitido (usar `token` cuando sea posible):

```json
{ "token": "tok_visa", "metadata": { "bookingId": "abc123" } }
```

o (solo en `mock` o si tu cuenta permite raw-pan):

```json
{
  "number": "4242424242424242",
  "exp_month": "12",
  "exp_year": "2026",
  "cvc": "123"
}
```

- Responses:

  - 200: `{ "valid": true, "result": { ... } }` (token o objeto devuelto)
  - 400: validación local fallida `{ "valid": false, "errors": [ { code, message } ] }`
  - 402/400: provider error (mapeado) `{ "valid": false, "error": "CARD_DECLINED", "message": "La tarjeta fue rechazada." }`

- POST `/api/payments/confirm-with-token`
  - Propósito: Permitir al backend crear y confirmar un PaymentIntent usando un `token` o `payment_method` enviado por el frontend (server-side confirm).
  - Body ejemplo:

```json
{
  "token": "pm_1Hxxxxx",
  "amount": 500,
  "currency": "usd",
  "metadata": { "bookingId": "abc123" }
}
```

- Responses:
  - 200: `{ "paymentIntent": { id, client_secret, status, ... } }` (en `mock` devuelve un intent simulado con `status: 'succeeded'`).
  - 400/402: `{ "error": "CARD_DECLINED", "message": "..." }` (errores mapeados a códigos amigables).

Notas:

- Siempre preferir tokenización client-side (Stripe Elements / Payment Methods). El endpoint `confirm-with-token` está pensado para flujos donde el frontend ya genera el `payment_method` o token.

---

### Mapeo de errores y contratos

El backend normaliza errores comunes de Stripe para que el frontend pueda actuar sin parsear mensajes crudos. Algunos códigos devueltos son:

- `CARD_DECLINED` — la tarjeta fue rechazada.
- `INCORRECT_CVC` — CVC incorrecto.
- `EXPIRED_CARD` — tarjeta expirada.
- `INVALID_NUMBER` — número inválido (Luhn / formato).
- `PAYMENT_ERROR` — error genérico del proveedor.

Cada error viene con `message` legible para mostrar en UI y un código `http` apropiado.

---

### Idempotencia de webhooks

Para evitar reprocesar el mismo evento (reintentos de Stripe), el webhook implementa idempotencia básica usando Upstash Redis:

- Se guarda una key `payment:webhook:<eventId>` (o un hash del payload cuando no hay `event.id`).
- Si la key ya existe, el webhook se marca como `skipped` y devuelve `{ received: true, skipped: true }`.
- La key tiene TTL (24h) para mantener protección contra reenvíos inmediatos.

Esto evita publicar el mismo `PagoConfirmado` dos veces en el `CHANNELS.PAGOS`.

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
