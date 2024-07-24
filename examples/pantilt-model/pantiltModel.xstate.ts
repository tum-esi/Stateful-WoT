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
let ws0 = new WebSocket("ws://127.0.0.1:8765");
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
const pantilt = createMachine(
  {
    id: "pantilt",
    initial: "_wotwrapper",
    context: {
      panPosition: 0,
      tiltPosition: 0,
      panTarget: 0,
      tiltTarget: 0,
      pan_speed: 0,
      tilt_speed: 0,
      _panCon_responseReceived: false,
      _tiltCon_responseReceived: false,
      _stepSize: "0.05s",
    },
    states: {
      _wotwrapper: {
        id: "_wotwrapper",
        type: "parallel",
        states: {
          _wotMachinewrapper: {
            id: "_wotMachinewrapper",
            initial: "servos",
            states: {
              servos: {
                id: "servos",
                type: "parallel",
                states: {
                  panServo: {
                    id: "panServo",
                    initial: "panIdle",
                    states: {
                      panIdle: {
                        id: "panIdle",
                        initial: undefined,
                        entry: [assign({ panTarget: 0 })],
                        on: {
                          "invokeaction.panTo": {
                            target: "#panToTarget",
                            actions: [
                              assign({
                                panTarget: (context: any, event: any) => {
                                  return event.data.payload;
                                },
                              }),
                            ],
                          },
                          "invokeaction.moveTo": {
                            target: "#panToTarget",
                            actions: [
                              assign({
                                panTarget: (context: any, event: any) => {
                                  return event.data.payload.panAngle;
                                },
                              }),
                            ],
                          },
                          "invokeaction.goHome": {
                            target: "#panToTarget",
                            actions: [assign({ panTarget: 0 })],
                          },
                          "invokeaction.panContinuously": {
                            target: "#panningContinuously",
                            cond: "cond_0",
                            actions: [
                              assign({
                                pan_speed: (context: any, event: any) => {
                                  return event.data.payload;
                                },
                              }),
                            ],
                          },
                          "invokeaction.moveContinuously": {
                            target: "#panningContinuously",
                            cond: "cond_1",
                            actions: [
                              assign({
                                pan_speed: (context: any, event: any) => {
                                  return event.data.payload.panSpeed;
                                },
                              }),
                            ],
                          },
                        },
                      },
                      panToTarget: {
                        id: "panToTarget",
                        initial: undefined,
                        on: {
                          simulationStep: {
                            target: "#panToTarget",
                            actions: [
                              {
                                type: "xstate.choose",
                                conds: [
                                  {
                                    actions: [
                                      assign({
                                        panPosition: (
                                          context: any,
                                          event: any
                                        ) => {
                                          return context["panTarget"] -
                                            context["panPosition"] >
                                            6
                                            ? context["panPosition"] + 6
                                            : context["panPosition"] +
                                                (context["panTarget"] -
                                                  context["panPosition"]);
                                        },
                                      }),
                                    ],
                                    cond: "cond_2",
                                  },
                                  {
                                    actions: [
                                      assign({
                                        panPosition: (
                                          context: any,
                                          event: any
                                        ) => {
                                          return context["panTarget"] -
                                            context["panPosition"] <
                                            -6
                                            ? context["panPosition"] - 6
                                            : context["panPosition"] +
                                                (context["panTarget"] -
                                                  context["panPosition"]);
                                        },
                                      }),
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                          "invokeaction.panContinuously": {
                            target: "#panningContinuously",
                            actions: [
                              { type: "xstate.raise", event: "notPanning" },
                            ],
                          },
                          "invokeaction.moveContinuously": {
                            target: "#panningContinuously",
                            actions: [
                              { type: "xstate.raise", event: "notPanning" },
                            ],
                          },
                        },
                        always: [
                          {
                            target: "#panIdle",
                            cond: "cond_3",
                            actions: [
                              { type: "xstate.raise", event: "notPanning" },
                              "wotResponse_1",
                            ],
                          },
                        ],
                      },
                      panningContinuously: {
                        id: "panningContinuously",
                        initial: "_panningContinuously_modelEntry",
                        entry: [],
                        on: {
                          "invokeaction.panTo": {
                            target: "#panToTarget",
                            actions: [
                              assign({
                                panTarget: (context: any, event: any) => {
                                  return event.data.payload;
                                },
                              }),
                            ],
                          },
                          "invokeaction.moveTo": {
                            target: "#panToTarget",
                            actions: [
                              assign({
                                panTarget: (context: any, event: any) => {
                                  return event.data.payload.panAngle;
                                },
                              }),
                            ],
                          },
                          "invokeaction.goHome": {
                            target: "#panToTarget",
                            actions: [assign({ panTarget: 0 })],
                          },
                          "invokeaction.stopMovement": {
                            target: "#panIdle",
                            actions: [
                              { type: "xstate.raise", event: "notPanning" },
                            ],
                          },
                        },
                        always: [
                          {
                            target: "#panIdle",
                            cond: "cond_4",
                            actions: [
                              { type: "xstate.raise", event: "notPanning" },
                            ],
                          },
                        ],
                        states: {
                          _panningContinuously_modelEntry: {
                            id: "_panningContinuously_modelEntry",
                            initial: undefined,
                            entry: ["wotSim_0"],
                            on: {
                              "_sim_panCon.response": {
                                target: "#_panningContinuously_modelPreTick",
                              },
                            },
                          },
                          _panningContinuously_modelPreTick: {
                            id: "_panningContinuously_modelPreTick",
                            initial: undefined,
                            entry: [
                              assign({
                                panPosition: (context: any, event: any) => {
                                  return event.data.outputs["pos"];
                                },
                              }),
                              assign({ _panCon_responseReceived: true }),
                            ],
                            on: {
                              simulationStep: {
                                target:
                                  "#_panningContinuously_modelTickResponse",
                                actions: ["wotSim_1"],
                              },
                            },
                          },
                          _panningContinuously_modelTickResponse: {
                            id: "_panningContinuously_modelTickResponse",
                            initial: undefined,
                            on: {
                              "_sim_panCon.response": {
                                target: "#_panningContinuously_modelPreTick",
                              },
                            },
                            entry: [
                              assign({ _panCon_responseReceived: false }),
                            ],
                          },
                        },
                      },
                    },
                  },
                  tiltServo: {
                    id: "tiltServo",
                    initial: "tiltIdle",
                    states: {
                      tiltIdle: {
                        id: "tiltIdle",
                        initial: undefined,
                        entry: [assign({ tiltTarget: 0 })],
                        on: {
                          "invokeaction.tiltTo": {
                            target: "#tiltToTarget",
                            actions: [
                              assign({
                                tiltTarget: (context: any, event: any) => {
                                  return event.data.payload;
                                },
                              }),
                            ],
                          },
                          "invokeaction.moveTo": {
                            target: "#tiltToTarget",
                            actions: [
                              assign({
                                tiltTarget: (context: any, event: any) => {
                                  return event.data.payload.tiltAngle;
                                },
                              }),
                            ],
                          },
                          "invokeaction.goHome": {
                            target: "#tiltToTarget",
                            actions: [assign({ tiltTarget: 0 })],
                          },
                          "invokeaction.tiltContinuously": {
                            target: "#tiltingContinuously",
                            cond: "cond_5",
                            actions: [
                              assign({
                                tilt_speed: (context: any, event: any) => {
                                  return event.data.payload;
                                },
                              }),
                            ],
                          },
                          "invokeaction.moveContinuously": {
                            target: "#tiltingContinuously",
                            cond: "cond_6",
                            actions: [
                              assign({
                                tilt_speed: (context: any, event: any) => {
                                  return event.data.payload.tiltSpeed;
                                },
                              }),
                            ],
                          },
                        },
                      },
                      tiltToTarget: {
                        id: "tiltToTarget",
                        initial: undefined,
                        on: {
                          simulationStep: {
                            target: "#tiltToTarget",
                            actions: [
                              {
                                type: "xstate.choose",
                                conds: [
                                  {
                                    actions: [
                                      assign({
                                        tiltPosition: (
                                          context: any,
                                          event: any
                                        ) => {
                                          return context["tiltTarget"] -
                                            context["tiltPosition"] >
                                            6
                                            ? context["tiltPosition"] + 6
                                            : context["tiltPosition"] +
                                                (context["tiltTarget"] -
                                                  context["tiltPosition"]);
                                        },
                                      }),
                                    ],
                                    cond: "cond_7",
                                  },
                                  {
                                    actions: [
                                      assign({
                                        tiltPosition: (
                                          context: any,
                                          event: any
                                        ) => {
                                          return context["tiltTarget"] -
                                            context["tiltPosition"] <
                                            -6
                                            ? context["tiltPosition"] - 6
                                            : context["tiltPosition"] +
                                                (context["tiltTarget"] -
                                                  context["tiltPosition"]);
                                        },
                                      }),
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                          "invokeaction.tiltContinuously": {
                            target: "#tiltingContinuously",
                            actions: [
                              { type: "xstate.raise", event: "notTilting" },
                            ],
                          },
                          "invokeaction.moveContinuously": {
                            target: "#tiltingContinuously",
                            actions: [
                              { type: "xstate.raise", event: "notTilting" },
                            ],
                          },
                        },
                        always: [
                          {
                            target: "#tiltIdle",
                            cond: "cond_8",
                            actions: [
                              { type: "xstate.raise", event: "notTilting" },
                              "wotResponse_3",
                            ],
                          },
                        ],
                      },
                      tiltingContinuously: {
                        id: "tiltingContinuously",
                        initial: "_tiltingContinuously_modelEntry",
                        entry: [],
                        on: {
                          "invokeaction.tiltTo": {
                            target: "#tiltToTarget",
                            actions: [
                              assign({
                                tiltTarget: (context: any, event: any) => {
                                  return event.data.payload;
                                },
                              }),
                            ],
                          },
                          "invokeaction.moveTo": {
                            target: "#tiltToTarget",
                            actions: [
                              assign({
                                tiltTarget: (context: any, event: any) => {
                                  return event.data.payload.tiltAngle;
                                },
                              }),
                            ],
                          },
                          "invokeaction.goHome": {
                            target: "#tiltToTarget",
                            actions: [assign({ tiltTarget: 0 })],
                          },
                          "invokeaction.stopMovement": {
                            target: "#tiltIdle",
                            actions: [
                              { type: "xstate.raise", event: "notTilting" },
                            ],
                          },
                        },
                        always: [
                          {
                            target: "#tiltIdle",
                            cond: "cond_9",
                            actions: [
                              { type: "xstate.raise", event: "notTilting" },
                            ],
                          },
                        ],
                        states: {
                          _tiltingContinuously_modelEntry: {
                            id: "_tiltingContinuously_modelEntry",
                            initial: undefined,
                            entry: ["wotSim_2"],
                            on: {
                              "_sim_tiltCon.response": {
                                target: "#_tiltingContinuously_modelPreTick",
                              },
                            },
                          },
                          _tiltingContinuously_modelPreTick: {
                            id: "_tiltingContinuously_modelPreTick",
                            initial: undefined,
                            entry: [
                              assign({
                                tiltPosition: (context: any, event: any) => {
                                  return event.data.outputs["pos"];
                                },
                              }),
                              assign({ _tiltCon_responseReceived: true }),
                            ],
                            on: {
                              simulationStep: {
                                target:
                                  "#_tiltingContinuously_modelTickResponse",
                                actions: ["wotSim_3"],
                              },
                            },
                          },
                          _tiltingContinuously_modelTickResponse: {
                            id: "_tiltingContinuously_modelTickResponse",
                            initial: undefined,
                            on: {
                              "_sim_tiltCon.response": {
                                target: "#_tiltingContinuously_modelPreTick",
                              },
                            },
                            entry: [
                              assign({ _tiltCon_responseReceived: false }),
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
          _simulationClock: {
            id: "_simulationClock",
            initial: "_clock_preTick",
            states: {
              _clock_preTick: {
                id: "_clock_preTick",
                initial: undefined,
                entry: [
                  send("simulationStep", {
                    delay: (context: any, event: any, { _event }): number => {
                      const delayExpr = context["_stepSize"];

                      return delayToMs(delayExpr);
                    },
                  }),
                ],
                on: { simulationStep: { target: "#_clock_postTick" } },
              },
              _clock_postTick: {
                id: "_clock_postTick",
                initial: undefined,
                always: [{ target: "#_clock_preTick", cond: "clockCond" }],
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
        responseHandlerEmitter.emit("actionDone");
      },
      wotResponse_1: (context, event) => {
        responseHandlerEmitter.emit("actionDone");
      },
      wotSim_0: (context, event) => {
        ws0.send(
          JSON.stringify({
            simId: "panCon",
            messageType: "reset",
            stepSize: delayToS(context["_stepSize"]),
            parameters: {
              speed: context["pan_speed"],
              startPos: context["panPosition"],
            },
          })
        );
      },
      wotSim_1: (context, event) => {
        ws0.send(
          JSON.stringify({
            simId: "panCon",
            messageType: "step",
          })
        );
      },
      wotResponse_2: (context, event) => {
        responseHandlerEmitter.emit("actionDone");
      },
      wotResponse_3: (context, event) => {
        responseHandlerEmitter.emit("actionDone");
      },
      wotSim_2: (context, event) => {
        ws0.send(
          JSON.stringify({
            simId: "tiltCon",
            messageType: "reset",
            stepSize: delayToS(context["_stepSize"]),
            parameters: {
              speed: context["tilt_speed"],
              startPos: context["tiltPosition"],
            },
          })
        );
      },
      wotSim_3: (context, event) => {
        ws0.send(
          JSON.stringify({
            simId: "tiltCon",
            messageType: "step",
          })
        );
      },
    },
    guards: {
      clockCond: (context: any, event: any, { cond, _event }) => {
        const stateString = JSON.stringify(service.getSnapshot().value);
        const reg = /_modelTickResponse/;
        return !reg.test(stateString);
      },
      cond_0: (context: any, event: any, { cond, _event }) =>
        event.data.payload !== 0,
      cond_1: (context: any, event: any, { cond, _event }) =>
        event.data.payload.panSpeed !== 0,
      cond_2: (context: any, event: any, { cond, _event }) =>
        context["panTarget"] - context["panPosition"] >= 0,
      cond_3: (context: any, event: any, { cond, _event }) =>
        context["panPosition"] === context["panTarget"],
      cond_4: (context: any, event: any, { cond, _event }) =>
        (context["panPosition"] >= 90 && context["pan_speed"] > 0) ||
        (context["panPosition"] <= -90 && context["pan_speed"] < 0) ||
        context["pan_speed"] === 0,
      cond_5: (context: any, event: any, { cond, _event }) =>
        event.data.payload !== 0,
      cond_6: (context: any, event: any, { cond, _event }) =>
        event.data.payload.tiltSpeed !== 0,
      cond_7: (context: any, event: any, { cond, _event }) =>
        context["tiltTarget"] - context["tiltPosition"] >= 0,
      cond_8: (context: any, event: any, { cond, _event }) =>
        context["tiltPosition"] === context["tiltTarget"],
      cond_9: (context: any, event: any, { cond, _event }) =>
        (context["tiltPosition"] >= 80 && context["tilt_speed"] > 0) ||
        (context["tiltPosition"] <= -80 && context["tilt_speed"] < 0) ||
        context["tilt_speed"] === 0,
    },
    delays: {},
    services: {},
  }
);

const service = interpret(pantilt);

/*=================================================== node-wot ==================================================*/
const td: any = {
  "@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
  "@type": "Thing",
  title: "machine",
  description: "",
  properties: {
    panPosition: {
      description: "The current position of the pan platform in degrees",
      maximum: 91,
      minimum: -91,
      observable: true,
      readOnly: true,
      title: "Pan Position",
      type: "number",
      unit: "degrees",
      writeOnly: false,
    },
    tiltPosition: {
      description: "The current position of the pan platform in degrees",
      maximum: 81,
      minimum: -81,
      observable: true,
      readOnly: true,
      title: "Tilt Position",
      type: "number",
      unit: "degrees",
      writeOnly: false,
    },
    panState: {
      title: "panServo",
      description: "Exposed State panServo",
      type: "string",
      enum: ["panIdle", "panToTarget", "panningContinuously"],
    },
    tiltState: {
      title: "tiltServo",
      description: "Exposed State tiltServo",
      type: "string",
      enum: ["tiltIdle", "tiltToTarget", "tiltingContinuously"],
    },
    state: { type: "object", readOnly: true },
  },
  actions: {
    tiltTo: {
      description:
        "Moves the tilt and pan platform with the speeds given in input until a stop action is invoked or limits are reached",
      synchronous: true,
      input: { maximum: 80, minimum: -80, type: "number", unit: "degrees" },
      idempotent: false,
      safe: false,
      title: "Tilt To",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.tiltTo",
          availableInState: [
            "tiltState.tiltIdle",
            "tiltState.tiltingContinuously",
          ],
          affects: ["tiltState"],
        },
      },
    },
    panTo: {
      description: "Moves the pan platform to the angle specific in the input",
      synchronous: true,
      idempotent: false,
      input: { maximum: 90, minimum: -90, type: "number", unit: "degrees" },
      safe: false,
      title: "Pan To",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.panTo",
          availableInState: [
            "panState.panIdle",
            "panState.panningContinuously",
          ],
          affects: ["panState"],
        },
      },
    },
    moveTo: {
      description:
        "Moves the tilt and pan platform to the angles given in input",
      idempotent: false,
      synchronous: false,
      input: {
        properties: {
          panAngle: {
            maximum: 90,
            minimum: -90,
            title: "Pan To",
            type: "number",
            unit: "degrees",
          },
          tiltAngle: {
            maximum: 80,
            minimum: -80,
            title: "Tilt To",
            type: "number",
            unit: "degrees",
          },
        },
        required: ["panAngle", "tiltAngle"],
        type: "object",
      },
      safe: false,
      title: "Move To",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.moveTo",
          availableInState: [
            "panState.panIdle",
            "panState.panningContinuously",
            "tiltState.tiltIdle",
            "tiltState.tiltingContinuously",
          ],
          affects: ["panState", "tiltState"],
        },
      },
    },
    tiltContinuously: {
      description:
        "Moves the tilt platform with speed given in input until a stop action is invoked or limits are reached",
      idempotent: false,
      synchronous: false,
      input: {
        description:
          "The speed at which the platform moves. Negative values for moving up and positive values for moving down",
        maximum: 15,
        minimum: -15,
        type: "number",
        unit: "angle per sec",
      },
      safe: false,
      title: "Tilt Continuously",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.tiltContinuously",
          availableInState: ["tiltState.tiltIdle", "tiltState.tiltToTarget"],
          affects: ["tiltState"],
          "tiltState.tiltIdle": [{ cond: "input !== 0" }],
        },
      },
    },
    panContinuously: {
      description:
        "Moves the pan platform with speed given in input until a stop action is invoked or limits are reached",
      idempotent: false,
      synchronous: false,
      input: {
        description:
          "The speed at which the platform moves. Negative values for right and positive values for left",
        maximum: 15,
        minimum: -15,
        type: "number",
        unit: "angle per sec",
      },
      safe: false,
      title: "Pan Continuously",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.panContinuously",
          availableInState: ["panState.panIdle", "panState.panToTarget"],
          affects: ["panState"],
          "panState.panIdle": [{ cond: "input !== 0" }],
        },
      },
    },
    moveContinuously: {
      description:
        "Moves the tilt and pan platform with the speeds given in input until a stop action is invoked or limits are reached",
      idempotent: false,
      synchronous: false,
      input: {
        properties: {
          panSpeed: {
            description:
              "The speed at which the platform moves. Negative values for right and positive values for left",
            maximum: 15,
            minimum: -15,
            type: "number",
            unit: "angle per sec",
          },
          tiltSpeed: {
            description:
              "The speed at which the tilt platform moves. Negative values for moving up and positive values for moving down",
            maximum: 15,
            minimum: -15,
            type: "number",
            unit: "angle per sec",
          },
        },
        required: ["panSpeed", "tiltSpeed"],
        type: "object",
      },
      safe: false,
      title: "Move Continuously",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.moveContinuously",
          availableInState: [
            "panState.panIdle",
            "panState.panToTarget",
            "tiltState.tiltIdle",
            "tiltState.tiltToTarget",
          ],
          affects: ["panState", "tiltState"],
          "panState.panIdle": [{ cond: "input.panSpeed !== 0" }],
          "tiltState.tiltIdle": [{ cond: "input.tiltSpeed !== 0" }],
        },
      },
    },
    goHome: {
      description:
        "Returns the pan and tilt to their home position which is at 0 and 0 degrees",
      idempotent: false,
      synchronous: false,
      safe: false,
      title: "Go Home",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.goHome",
          availableInState: [
            "panState.panIdle",
            "panState.panningContinuously",
            "tiltState.tiltIdle",
            "tiltState.tiltingContinuously",
          ],
          affects: ["panState", "tiltState"],
        },
      },
    },
    stopMovement: {
      description:
        "Stops any movement that was created with continuous movement calls",
      idempotent: false,
      synchronous: false,
      safe: false,
      title: "Stop Movement",
      "scxml:action": {
        invokeaction: {
          event: "invokeaction.stopMovement",
          availableInState: [
            "panState.panningContinuously",
            "tiltState.tiltingContinuously",
          ],
          affects: ["panState", "tiltState"],
        },
      },
    },
  },
  events: {
    actionDone: {
      description: "Event that fires when the last action is done",
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
    "panPosition",
    async () => service.getSnapshot().context["panPosition"]
  );
  thing.setPropertyReadHandler(
    "tiltPosition",
    async () => service.getSnapshot().context["tiltPosition"]
  );
  thing.setPropertyReadHandler(
    "panState",
    () => service.getSnapshot().value["servos"]["panServo"]
  );
  thing.setPropertyReadHandler(
    "tiltState",
    () => service.getSnapshot().value["servos"]["tiltServo"]
  );
  thing.setPropertyReadHandler("state", async () =>
    service.getSnapshot().toJSON()
  );

  /*=========================================== Property Write Handlers ===========================================*/

  /*============================================ Invoke Action Handlers ===========================================*/

  thing.setActionHandler("tiltTo", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
      ].some(currentState.matches)
    ) {
      throw new Error("invokeaction tiltTo is not accessible in current state");
    } else {
      const responsePromise = once(
        responseHandlerEmitter,
        "response.invokeaction.tiltTo"
      );
      service.send({
        type: "invokeaction.tiltTo",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("panTo", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
        "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
      ].some(currentState.matches)
    ) {
      throw new Error("invokeaction panTo is not accessible in current state");
    } else {
      const responsePromise = once(
        responseHandlerEmitter,
        "response.invokeaction.panTo"
      );
      service.send({
        type: "invokeaction.panTo",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("moveTo", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
        "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
      ].some(currentState.matches)
    ) {
      throw new Error("invokeaction moveTo is not accessible in current state");
    } else {
      service.send({
        type: "invokeaction.moveTo",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      return undefined;
    }
  });
  thing.setActionHandler("tiltContinuously", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltToTarget",
      ].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction tiltContinuously is not accessible in current state"
      );
    } else {
      service.send({
        type: "invokeaction.tiltContinuously",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      return undefined;
    }
  });
  thing.setActionHandler("panContinuously", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
        "_wotwrapper._wotMachinewrapper.servos.panServo.panToTarget",
      ].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction panContinuously is not accessible in current state"
      );
    } else {
      service.send({
        type: "invokeaction.panContinuously",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      return undefined;
    }
  });
  thing.setActionHandler("moveContinuously", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
        "_wotwrapper._wotMachinewrapper.servos.panServo.panToTarget",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltToTarget",
      ].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction moveContinuously is not accessible in current state"
      );
    } else {
      service.send({
        type: "invokeaction.moveContinuously",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      return undefined;
    }
  });
  thing.setActionHandler("goHome", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
        "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
      ].some(currentState.matches)
    ) {
      throw new Error("invokeaction goHome is not accessible in current state");
    } else {
      service.send({
        type: "invokeaction.goHome",
        // data: {
        //   payload: await inputData.value(),
        //   uriVariables: options?.uriVariables,
        // },
      } as any);
      return undefined;
    }
  });
  thing.setActionHandler("stopMovement", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (
      ![
        "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
        "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
      ].some(currentState.matches)
    ) {
      throw new Error(
        "invokeaction stopMovement is not accessible in current state"
      );
    } else {
      service.send({
        type: "invokeaction.stopMovement",
        // data: {
        //   payload: await inputData.value(),
        //   uriVariables: options?.uriVariables,
        // },
      } as any);
      return undefined;
    }
  });

  /*================================================ Event Emitters ===============================================*/

  responseHandlerEmitter.on("actionDone", (data) => {
    thing.emitEvent("actionDone", data);
  });

  /*================================================= On Transition ===============================================*/

  let lastState, lastContext;
  service.onTransition((state) => {
    console.log(`${td.title}:`);
    console.log(`Recieved Event: ${JSON.stringify(state.event)}`);
    console.log(`Current State: ${JSON.stringify(state.value)}`);

    if (
      lastContext !== undefined &&
      lastContext["panPosition"] !== state.context["panPosition"]
    )
      thing.emitPropertyChange("panPosition");
    if (
      lastContext !== undefined &&
      lastContext["tiltPosition"] !== state.context["tiltPosition"]
    )
      thing.emitPropertyChange("tiltPosition");

    lastState = state;
    lastContext = state.context;
  });

  //Start State Machine and Server
  service.start();
  thing.expose();
});
ws0.on("message", (responseMessage: string) => {
  const response = JSON.parse(responseMessage);
  const simId = response.simId;
  service.send({
    type: `_sim_${simId}.response`,
    data: response as any,
  });
});
