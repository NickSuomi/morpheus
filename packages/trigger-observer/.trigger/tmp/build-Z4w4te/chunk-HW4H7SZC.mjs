import { ZodSchemaParsedError, external_exports } from "./chunk-QG5B3WVB.mjs";
import { __name, init_esm } from "./chunk-GKTAOGFS.mjs";

// ../../../../.prototypes/trigger-dev/node_modules/.pnpm/@trigger.dev+core@4.5.4_supports-color@10.2.2/node_modules/@trigger.dev/core/dist/esm/v3/zodIpc.js
init_esm();
import { randomUUID } from "crypto";
var messageSchema = external_exports.object({
  version: external_exports.literal("v1").default("v1"),
  type: external_exports.string(),
  payload: external_exports.unknown(),
});
var ZodIpcMessageHandler = class {
  static {
    __name(this, "ZodIpcMessageHandler");
  }
  #schema;
  #handlers;
  #sender;
  constructor(options) {
    this.#schema = options.schema;
    this.#handlers = options.handlers;
    this.#sender = options.sender;
  }
  async handleMessage(message) {
    const parsedMessage = this.parseMessage(message);
    if (!this.#handlers) {
      throw new Error("No handlers provided");
    }
    const handler = this.#handlers[parsedMessage.type];
    if (!handler) {
      return;
    }
    const ack = await handler(parsedMessage.payload, this.#sender);
    return ack;
  }
  parseMessage(message) {
    const parsedMessage = messageSchema.safeParse(message);
    if (!parsedMessage.success) {
      throw new Error(`Failed to parse message: ${JSON.stringify(parsedMessage.error)}`);
    }
    const schema = this.#schema[parsedMessage.data.type]?.["message"];
    if (!schema) {
      throw new Error(`Unknown message type: ${parsedMessage.data.type}`);
    }
    const parsedPayload = schema.safeParse(parsedMessage.data.payload);
    if (!parsedPayload.success) {
      throw new Error(`Failed to parse message payload: ${JSON.stringify(parsedPayload.error)}`);
    }
    return {
      type: parsedMessage.data.type,
      payload: parsedPayload.data,
    };
  }
};
var Packet = external_exports.discriminatedUnion("type", [
  external_exports.object({
    type: external_exports.literal("CONNECT"),
    sessionId: external_exports.string().optional(),
  }),
  external_exports.object({
    type: external_exports.literal("ACK"),
    message: external_exports.any(),
    id: external_exports.number(),
  }),
  external_exports.object({
    type: external_exports.literal("EVENT"),
    message: external_exports.any(),
    id: external_exports.number().optional(),
  }),
]);
var ZodIpcConnection = class {
  static {
    __name(this, "ZodIpcConnection");
  }
  opts;
  #sessionId;
  #messageCounter = 0;
  #handler;
  #acks = /* @__PURE__ */ new Map();
  constructor(opts) {
    this.opts = opts;
    this.#handler = new ZodIpcMessageHandler({
      schema: opts.listenSchema,
      handlers: opts.handlers,
      sender: {
        send: this.send.bind(this),
        sendWithAck: this.sendWithAck.bind(this),
      },
    });
    this.#registerHandlers();
  }
  async #registerHandlers() {
    if (!this.opts.process.on) {
      return;
    }
    this.opts.process.on("message", async (message) => {
      this.#handlePacket(message);
    });
  }
  async connect() {
    this.#sendPacket({ type: "CONNECT" });
  }
  async #handlePacket(packet) {
    const parsedPacket = Packet.safeParse(packet);
    if (!parsedPacket.success) {
      return;
    }
    switch (parsedPacket.data.type) {
      case "ACK": {
        const ack = this.#acks.get(parsedPacket.data.id);
        if (!ack) {
          return;
        }
        clearTimeout(ack.timeout);
        ack.resolve(parsedPacket.data.message);
        break;
      }
      case "CONNECT": {
        if (!parsedPacket.data.sessionId) {
          const id = randomUUID();
          await this.#sendPacket({ type: "CONNECT", sessionId: id });
          return;
        }
        if (this.#sessionId) {
          return;
        }
        this.#sessionId = parsedPacket.data.sessionId;
        break;
      }
      case "EVENT": {
        const result = await this.#handler.handleMessage(parsedPacket.data.message);
        if (typeof parsedPacket.data.id === "undefined") {
          return;
        }
        await this.#sendPacket({
          type: "ACK",
          id: parsedPacket.data.id,
          message: result,
        });
        break;
      }
      default: {
        break;
      }
    }
  }
  async #sendPacket(packet) {
    if (this.opts.process.connected === false) {
      return;
    }
    try {
      await this.opts.process.send?.(packet);
    } catch {}
  }
  async send(type, payload) {
    const schema = this.opts.emitSchema[type]?.["message"];
    if (!schema) {
      throw new Error(`Unknown message type: ${type}`);
    }
    const parsedPayload = schema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new ZodSchemaParsedError(parsedPayload.error, payload);
    }
    await this.#sendPacket({
      type: "EVENT",
      message: {
        type,
        payload,
        version: "v1",
      },
    });
  }
  async sendWithAck(type, payload, timeoutInMs) {
    const currentId = this.#messageCounter++;
    return new Promise((resolve, reject) => {
      const defaultTimeoutInMs = 2e3;
      const timeout = setTimeout(() => {
        reject(
          JSON.stringify({
            reason: "sendWithAck() timeout",
            timeoutInMs: timeoutInMs ?? defaultTimeoutInMs,
            type,
            payload,
          }),
        );
      }, timeoutInMs ?? defaultTimeoutInMs);
      this.#acks.set(currentId, { resolve, reject, timeout });
      const schema = this.opts.emitSchema[type]?.["message"];
      if (!schema) {
        clearTimeout(timeout);
        return reject(`Unknown message type: ${type}`);
      }
      const parsedPayload = schema.safeParse(payload);
      if (!parsedPayload.success) {
        clearTimeout(timeout);
        return reject(`Failed to parse message payload: ${JSON.stringify(parsedPayload.error)}`);
      }
      this.#sendPacket({
        type: "EVENT",
        message: {
          type,
          payload,
          version: "v1",
        },
        id: currentId,
      }).catch(reject);
    });
  }
};

export { ZodIpcConnection };
//# sourceMappingURL=chunk-HW4H7SZC.mjs.map
