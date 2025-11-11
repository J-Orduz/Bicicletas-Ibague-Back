import Redis from "ioredis";
import { config } from "../config.js";

const publisher = new Redis(config.redisUrl);
const subscriber = new Redis(config.redisUrl);

export const eventBus = {
  publish: async (event, payload) => {
    await publisher.publish(event, JSON.stringify(payload));
  },

  subscribe: (event, handler) => {
    subscriber.subscribe(event);
    subscriber.on("message", (channel, message) => {
      if (channel === event) handler(JSON.parse(message));
    });
  },
};