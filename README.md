# Bicicletas-Ibague-Back

## Run MQTT Broker (eclipse-mosquitto)
With docker, in a cli, cd to backend/mqtt-iot and run:
`docker-compose up`

## Run Backend Server

Navigate to backend folder and run:
```
npm install
node server.js
```
## Core Dependencies

- `express`
- `mqtt` - Client for connecting to MQTT broker
- `@supabase/supabase-js` - Supabase client for database and authentication
- `@upstash/redis` - Redis client for event bus
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variables management
