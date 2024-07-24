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
const altivar320 = createMachine(
  {
    id: "altivar320",
    initial: "_wotwrapper",
    context: {
      powerAbsent: true,
      statusDisplay: "",
      quickStopCode: 2,
      _stepSize: "0.01s",
    },
    states: {
      _wotwrapper: {
        id: "_wotwrapper",
        type: "parallel",
        states: {
          _wotMachinewrapper: {
            id: "_wotMachinewrapper",
            initial: "drive",
            states: {
              drive: {
                id: "drive",
                initial: "1",
                states: {
                  1: {
                    id: "1",
                    initial: undefined,
                    always: [{ target: "#2" }],
                  },
                  2: {
                    id: "2",
                    initial: undefined,
                    entry: [
                      assign({ statusDisplay: "NST" }),
                      {
                        type: "xstate.choose",
                        conds: [
                          { actions: ["wotResponse_0"], cond: "cond_0" },
                          { actions: ["wotResponse_1"], cond: "cond_1" },
                          { actions: ["wotResponse_2"], cond: "cond_2" },
                        ],
                      },
                    ],
                    on: { "invokeaction.shutdown": { target: "#3" } },
                  },
                  3: {
                    id: "3",
                    initial: undefined,
                    entry: [
                      {
                        type: "xstate.choose",
                        conds: [
                          {
                            actions: [assign({ statusDisplay: "NLP" })],
                            cond: "cond_3",
                          },
                          { actions: [assign({ statusDisplay: "RDY" })] },
                        ],
                      },
                      {
                        type: "xstate.choose",
                        conds: [{ actions: ["wotResponse_3"], cond: "cond_4" }],
                      },
                    ],
                    on: {
                      "invokeaction.disablevoltage": { target: "#2" },
                      "invokeaction.quickstop": { target: "#2" },
                      stopkeypressed: { target: "#2" },
                      "invokeaction.switchon": {
                        target: "#4",
                        actions: [assign({ statusDisplay: "RDY" })],
                      },
                    },
                  },
                  4: {
                    id: "4",
                    initial: undefined,
                    entry: [
                      assign({ statusDisplay: "RDY" }),
                      {
                        type: "xstate.choose",
                        conds: [
                          { actions: ["wotResponse_4"], cond: "cond_5" },
                          { actions: ["wotResponse_5"], cond: "cond_6" },
                        ],
                      },
                    ],
                    on: {
                      "invokeaction.enableoperation": { target: "#5" },
                      "invokeaction.shutdown": { target: "#3" },
                      stopkeypressed: [{ target: "#3" }, { target: "#2" }],
                      "invokeaction.disablevoltage": { target: "#2" },
                      "invokeaction.quickstop": { target: "#2" },
                    },
                  },
                  5: {
                    id: "5",
                    initial: undefined,
                    entry: [
                      assign({ statusDisplay: "RUN" }),
                      {
                        type: "xstate.choose",
                        conds: [{ actions: ["wotResponse_6"], cond: "cond_7" }],
                      },
                    ],
                    on: {
                      "invokeaction.disableoperation": { target: "#4" },
                      faststop: {
                        target: "#4",
                        actions: [assign({ statusDisplay: "FST" })],
                      },
                      "invokeaction.shutdown": { target: "#3" },
                      "invokeaction.disablevoltage": { target: "#2" },
                      freewheelstop: { target: "#2" },
                      stopkeypressed: { target: "#2" },
                      sto: { target: "#2" },
                      "invokeaction.quickstop": { target: "#6" },
                    },
                  },
                  6: {
                    id: "6",
                    initial: undefined,
                    entry: [
                      assign({ statusDisplay: "FST" }),
                      {
                        type: "xstate.choose",
                        conds: [{ actions: ["wotResponse_7"], cond: "cond_8" }],
                      },
                    ],
                    always: [{ target: "#2", cond: "cond_9" }],
                    on: {
                      "invokeaction.disablevoltage": {
                        target: "#2",
                        cond: "cond_10",
                      },
                      stopkeypressed: { target: "#2" },
                    },
                  },
                },
                on: { fault: { target: "#fault" } },
              },
              fault: {
                id: "fault",
                initial: "7",
                states: {
                  7: {
                    id: "7",
                    initial: undefined,
                    always: [{ target: "#8" }],
                  },
                  8: {
                    id: "8",
                    initial: undefined,
                    entry: ["wotResponse_8"],
                    on: { "invokeaction.faultreset": { target: "#2" } },
                  },
                },
              },
            },
          },
          _propertywriteHandler: {
            id: "_propertywriteHandler",
            initial: undefined,
            on: {
              "*": {
                target: "#_propertywriteHandler",
                cond: "cond_11",
                actions: [
                  assign((context: any, event: any) => {
                    const update: Record<string, any> = {};
                    update[event.type.split(".")[1]] = {
                      ...context[event.type.split(".")[1]],
                    };
                    update[event.type.split(".")[1]] = event.data.payload;
                    return update;
                  }),
                ],
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
        responseHandlerEmitter.emit("disablevoltage.done");
      },
      wotResponse_1: (context, event) => {
        responseHandlerEmitter.emit("quickstop.done");
      },
      wotResponse_2: (context, event) => {
        responseHandlerEmitter.emit("faultreset.done");
      },
      wotResponse_3: (context, event) => {
        responseHandlerEmitter.emit("shutdown.done");
      },
      wotResponse_4: (context, event) => {
        responseHandlerEmitter.emit("switchon.done");
      },
      wotResponse_5: (context, event) => {
        responseHandlerEmitter.emit("disableoperation.done");
      },
      wotResponse_6: (context, event) => {
        responseHandlerEmitter.emit("enableoperation.done");
      },
      wotResponse_7: (context, event) => {
        responseHandlerEmitter.emit("quickstop.done");
      },
      wotResponse_8: (context, event) => {
        responseHandlerEmitter.emit("fault");
      },
    },
    guards: {
      cond_0: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.disablevoltage",
      cond_1: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.quickstop",
      cond_2: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.faultreset",
      cond_3: (context: any, event: any, { cond, _event }) =>
        context["powerAbsent"] === false,
      cond_4: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.shutdown",
      cond_5: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.switchon",
      cond_6: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.disableoperation",
      cond_7: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.enableoperation",
      cond_8: (context: any, event: any, { cond, _event }) =>
        event.id === "invokeaction.quickstop",
      cond_9: (context: any, event: any, { cond, _event }) =>
        context["quickStopCode"] === 2,
      cond_10: (context: any, event: any, { cond, _event }) =>
        context["quickStopCode"] === 6,
      cond_11: (context: any, event: any, { cond, _event }) =>
        event.type.includes("writeproperty"),
    },
    delays: {},
    services: {},
  }
);

const service = interpret(altivar320);

/*=================================================== node-wot ==================================================*/
const td: any = {
  "@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
  "@type": "Thing",
  title: "machine",
  description: "",
  properties: {
    driveStatus: {
      description:
        "States are:\n1 - Not ready to switch on\n2 - Switch on disabled\n3 - Ready to switch on\n4 - Switched on\n5 - Operation enabled\n6 - Quick stop active\n7 - Fault reaction active\n8 - Fault",
      readonly: true,
      observable: true,
      title: "drive",
      type: "string",
      enum: ["1", "2", "3", "4", "5", "6"],
    },
    statusDisplay: { type: "string", readonly: true, writeonly: false },
    powerStatus: { type: "boolean", readonly: false, writeonly: false },
    quickStopCode: { type: "number", readonly: false, writeonly: false },
    state: { type: "object", readOnly: true },
  },
  actions: {
    shutdown: { description: "Shutdown" },
    switchOn: { description: "Switch on" },
    enableOperation: {
      description: "Enable operation",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.enableoperation",
          availableInState: ["driveStatus.4"],
          affects: ["driveStatus"],
        },
      },
      synchronous: true,
    },
    disableOperation: {
      description: "Disable operation",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.disableoperation",
          availableInState: ["driveStatus.5"],
          affects: ["driveStatus"],
        },
      },
      synchronous: true,
    },
    disableVoltage: {
      description: "Disable voltage",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.disablevoltage",
          availableInState: [
            "driveStatus.3",
            "driveStatus.4",
            "driveStatus.5",
            "driveStatus.6",
          ],
          affects: ["driveStatus"],
          "driveStatus.6": [{ cond: "quickStopCode === 6" }],
        },
      },
      synchronous: true,
    },
    quickStop: {
      description: "Quick stop",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.quickstop",
          availableInState: ["driveStatus.3", "driveStatus.4", "driveStatus.5"],
          affects: ["driveStatus"],
        },
      },
      synchronous: true,
    },
    faultReset: {
      description: "Shutdown",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.faultreset",
          availableInState: [],
        },
      },
      synchronous: true,
    },
  },
  events: { fault: { description: "Fault raised" } },
};

const servient = new Servient();
servient.addServer(new HttpServer());
servient.addClientFactory(new HttpClientFactory());
Helpers.setStaticAddress("localhost");

servient.start().then(async (WoT) => {
  const thing = await WoT.produce(td);

  /*============================================ Property Read Handlers ===========================================*/

  thing.setPropertyReadHandler(
    "driveStatus",
    () => service.getSnapshot().value["drive"]
  );
  thing.setPropertyReadHandler(
    "statusDisplay",
    async () => service.getSnapshot().context["statusDisplay"]
  );
  thing.setPropertyReadHandler(
    "powerStatus",
    async () => service.getSnapshot().context["powerAbsent"]
  );
  thing.setPropertyReadHandler(
    "quickStopCode",
    async () => service.getSnapshot().context["quickStopCode"]
  );
  thing.setPropertyReadHandler("state", async () =>
    service.getSnapshot().toJSON()
  );

  /*=========================================== Prsoperty Write Handlers ===========================================*/

  thing.setPropertyWriteHandler("statusDisplay", async (input, options) => {
    service.send({
      type: "writeproperty.statusDisplay",
      data: {
        payload: await input.value(),
        uriVariables: options?.uriVariables,
      },
    } as any);
  });
  thing.setPropertyWriteHandler("powerStatus", async (input, options) => {
    service.send({
      type: "writeproperty.powerStatus",
      data: {
        payload: await input.value(),
        uriVariables: options?.uriVariables,
      },
    } as any);
  });
  thing.setPropertyWriteHandler("quickStopCode", async (input, options) => {
    service.send({
      type: "writeproperty.quickStopCode",
      data: {
        payload: await input.value(),
        uriVariables: options?.uriVariables,
      },
    } as any);
  });

  /*============================================ Invoke Action Handlers ===========================================*/

  thing.setActionHandler("enableOperation", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      !["_wotwrapper._wotMachinewrapper.drive.4"].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction enableOperation is not accessible in current state"
      );
    } else {
      const responsePromise = once(
        responseHandlerEmitter,
        "enableoperation.done"
      );
      service.send({ type: "invokeaction.enableoperation" } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("disableOperation", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      !["_wotwrapper._wotMachinewrapper.drive.5"].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction disableOperation is not accessible in current state"
      );
    } else {
      const responsePromise = once(
        responseHandlerEmitter,
        "disableoperation.done"
      );
      service.send({ type: "invokeaction.disableoperation" } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("disableVoltage", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.drive.3",
        "_wotwrapper._wotMachinewrapper.drive.4",
        "_wotwrapper._wotMachinewrapper.drive.5",
        "_wotwrapper._wotMachinewrapper.drive.6",
      ].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction disableVoltage is not accessible in current state"
      );
    } else {
      const responsePromise = once(
        responseHandlerEmitter,
        "disablevoltage.done"
      );
      service.send({ type: "invokeaction.disablevoltage" } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("quickStop", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.drive.3",
        "_wotwrapper._wotMachinewrapper.drive.4",
        "_wotwrapper._wotMachinewrapper.drive.5",
      ].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction quickStop is not accessible in current state"
      );
    } else {
      const responsePromise = once(responseHandlerEmitter, "quickstop.done");
      service.send({ type: "invokeaction.quickstop" } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("faultReset", async (inputData, options) => {
    const responsePromise = once(responseHandlerEmitter, "faultreset.done");
    service.send({ type: "invokeaction.faultreset" } as any);
    const [data] = await responsePromise;
    return data;
  });

  /*================================================ Event Emitters ===============================================*/

  responseHandlerEmitter.on("fault", (data) => {
    thing.emitEvent("fault", data);
  });

  /*================================================= On Transition ===============================================*/

  let lastState, lastContext;
  service.onTransition((state) => {
    console.log(`${td.title}:`);
    console.log(`Recieved Event: ${JSON.stringify(state.event)}`);
    console.log(`Current State: ${JSON.stringify(state.value)}`);

    if (
      lastState !== undefined &&
      lastContext.value["drive"] !== state.value["drive"]
    )
      thing.emitPropertyChange("driveStatus");

    lastState = state;
    lastContext = state.context;
  });

  //Start State Machine and Server
  service.start();
  thing.expose();
});
