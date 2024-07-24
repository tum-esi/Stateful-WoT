import { Servient, Helpers } from "@node-wot/core";
import {
  HttpServer,
  HttpClientFactory,
  HttpsClientFactory,
} from "@node-wot/binding-http";
import WebSocket from "ws";
import { EventEmitter, once } from "events";
import _ from "lodash";
class ResponseHandlerEmitter extends EventEmitter {}
const responseHandlerEmitter = new ResponseHandlerEmitter();
import {
  createMachine,
  interpret,
  actions,
  spawn,
  AnyStateMachine,
  sendParent,
} from "xstate";
const { choose, log, assign, raise, send, cancel, start, stop } = actions;

/*======================================================= Utility functions =======================================================*/

function delayToMs(delay: string | number): number {
  if (typeof delay === "number") {
    return delay;
  }

  const millisecondsMatch = delay.match(/(\d+)\s*ms/);
  if (millisecondsMatch !== null) {
    return parseInt(millisecondsMatch[1], 10);
  }

  const secondsMatch = delay.match(/((\d+)|(\d*)(\.?)(\d+))\s*s/);

  if (secondsMatch !== null) {
    const hasDecimal = secondsMatch[4] !== undefined;
    if (!hasDecimal) {
      return parseInt(secondsMatch[2], 10) * 1000;
    }

    const secondsPart = !(secondsMatch[3] !== undefined)
      ? parseInt(secondsMatch[3], 10) * 1000
      : 0;

    let millisecondsPart = parseFloat(`0.${secondsMatch[5]}`) * 1000;
    millisecondsPart = Math.floor(millisecondsPart);

    if (millisecondsPart >= 1000) {
      throw new Error(`Can't parse "${delay} delay."`);
    }

    return secondsPart + millisecondsPart;
  }

  throw new Error(`Can't parse "${delay} delay."`);
}

function delayToS(delay: string | number): number {
  const ms = delayToMs(delay);
  return ms / 1000;
}

function InvokedMachineFactory(
  machine: AnyStateMachine,
  initContext: any
): AnyStateMachine {
  return machine.withContext(initContext);
}

/*======================================================= Child Machines =======================================================*/

/*======================================================= Main Machine =======================================================*/
const machine = createMachine(
  {
    initial: "microwave",
    context: { cook_time: 5, door_closed: true, timer: 0, _stepSize: "0.01s" },
    states: {
      microwave: {
        id: "microwave",
        initial: "off",
        states: {
          off: {
            id: "off",
            initial: undefined,
            entry: ["wotResponse_0", assign({ timer: 0 })],
            on: { "turn.on": { target: "#on" } },
          },
          on: {
            id: "on",
            initial: "idle",
            entry: ["wotResponse_1"],
            on: { "turn.off": { target: "#off" } },
            always: [
              { target: "#off", cond: "cond_0", actions: ["wotResponse_2"] },
            ],
            states: {
              idle: {
                id: "idle",
                initial: undefined,
                always: [{ target: "#cooking", cond: "cond_1" }],
                on: {
                  "door.close": {
                    target: "#cooking",
                    actions: [assign({ door_closed: true })],
                  },
                },
              },
              cooking: {
                id: "cooking",
                initial: undefined,
                on: {
                  "door.open": {
                    target: "#idle",
                    actions: [assign({ door_closed: false })],
                  },
                  time: {
                    actions: [
                      assign({
                        timer: (context: any, event: any) => {
                          return context["timer"] + 1;
                        },
                      }),
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    actions: {
      wotResponse_0: (context, event) => {
        responseHandlerEmitter.emit("turn.off.done");
      },
      wotResponse_1: (context, event) => {
        responseHandlerEmitter.emit("turn.on.done");
      },
      wotResponse_2: (context, event) => {
        responseHandlerEmitter.emit("cooking.done");
      },
    },
    guards: {
      cond_0: (context: any, event: any, { cond, _event }) =>
        context["timer"] >= context["cook_time"],
      cond_1: (context: any, event: any, { cond, _event }) =>
        context["door_closed"],
    },
    delays: {},
    services: {},
  }
);

const service = interpret(machine);

/*=================================================== node-wot ==================================================*/
const td: any = {
  "@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
  "@type": "Thing",
  title: "machine",
  description: "",
  properties: {
    microwaveState: {
      title: "Microwave State",
      description: "States if the microwave is on or off",
      readonly: true,
      oneOf: [
        { type: "string", enum: ["off"] },
        {
          type: "object",
          required: ["on"],
          properties: { on: { type: "string", enum: ["idle", "cooking"] } },
        },
      ],
    },
    operationState: {
      title: "Microwave State",
      description: "States if the microwave is on or off",
      readonly: true,
      type: "string",
      enum: ["idle", "cooking"],
      "scxml:property": {
        readproperty: { availableInState: ["microwaveState.microwave.on"] },
      },
    },
    state: { type: "object", readOnly: true },
  },
  actions: {
    turnOn: {
      title: "Turn On",
      description: "Turn Microwave on",
      "scxml:action": {
        invokeaction: {
          event: "turn.on",
          availableInState: ["microwaveState.off"],
          affects: ["microwaveState"],
        },
      },
      synchronous: true,
    },
    turnOff: {
      title: "Turn off",
      description: "Turn Microwave off",
      "scxml:action": {
        invokeaction: {
          event: "turn.off",
          availableInState: ["microwaveState.on"],
          affects: ["microwaveState"],
        },
      },
      synchronous: true,
    },
    step: {
      title: "Step",
      description: "Step through time, sending a 'time' event",
      "scxml:action": {
        invokeaction: {
          event: "time",
          availableInState: ["operationState.cooking"],
          affects: ["operationState"],
        },
      },
      synchronous: false,
    },
  },
  events: {
    cookingDone: {
      title: "Cooking Done",
      description: "Notification when cooking is done",
    },
  },
};

const servient = new Servient();
servient.addServer(new HttpServer());
servient.addClientFactory(new HttpClientFactory());
Helpers.setStaticAddress("localhost");

servient.start().then(async (WoT) => {
  const thing = await WoT.produce(td);

  /*============================================ Property Read Handlers ===========================================*/

  thing.setPropertyReadHandler(
    "microwaveState",
    () => service.getSnapshot().value["microwave"]
  );
  thing.setPropertyReadHandler(
    "operationState",
    () => service.getSnapshot().value["microwave"]["on"]
  );
  thing.setPropertyReadHandler("state", async () =>
    service.getSnapshot().toJSON()
  );
  thing.setPropertyReadHandler("operationState", async () => {
    const currentState = service.getSnapshot();
    if (!["microwave.on"].some(currentState.matches)) {
      throw new Error(
        "readproperty operationState is not accessible in current state"
      );
    } else {
      return service.getSnapshot().value["microwave"]["on"];
    }
  });

  /*=========================================== Property Write Handlers ===========================================*/

  /*============================================ Invoke Action Handlers ===========================================*/

  thing.setActionHandler("turnOn", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (!["microwave.off"].some(currentState.matches)) {
      throw new Error("invokeaction turnOn is not accessible in current state");
    } else {
      const responsePromise = once(responseHandlerEmitter, "turn.on.done");
      service.send({ type: "turn.on" } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("turnOff", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (!["microwave.on"].some(currentState.matches)) {
      throw new Error(
        "invokeaction turnOff is not accessible in current state"
      );
    } else {
      const responsePromise = once(responseHandlerEmitter, "turn.off.done");
      service.send({ type: "turn.off" } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("step", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (!["microwave.on.cooking"].some(currentState.matches)) {
      throw new Error("invokeaction step is not accessible in current state");
    } else {
      service.send({ type: "time" } as any);
      return undefined;
    }
  });

  /*================================================ Event Emitters ===============================================*/

  responseHandlerEmitter.on("cooking.done", (data) => {
    thing.emitEvent("cookingDone", data);
  });

  /*================================================= On Transition ===============================================*/

  let lastState, lastContext;
  service.onTransition((state) => {
    console.log(`${td.title}:`);
    console.log(`Recieved Event: ${JSON.stringify(state.event)}`);
    console.log(`Current State: ${JSON.stringify(state.value)}`);

    lastState = state;
    lastContext = state.context;
  });

  //Start State Machine and Server
  service.start();
  thing.expose();
});
