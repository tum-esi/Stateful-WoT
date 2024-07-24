"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@node-wot/core");
var binding_http_1 = require("@node-wot/binding-http");
var ws_1 = __importDefault(require("ws"));
var events_1 = require("events");
var ResponseHandlerEmitter = /** @class */ (function (_super) {
    __extends(ResponseHandlerEmitter, _super);
    function ResponseHandlerEmitter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ResponseHandlerEmitter;
}(events_1.EventEmitter));
var responseHandlerEmitter = new ResponseHandlerEmitter();
var ws0 = new ws_1.default("ws://127.0.0.1:8765");
var xstate_1 = require("xstate");
var choose = xstate_1.actions.choose, log = xstate_1.actions.log, assign = xstate_1.actions.assign, raise = xstate_1.actions.raise, send = xstate_1.actions.send, cancel = xstate_1.actions.cancel, start = xstate_1.actions.start, stop = xstate_1.actions.stop;
/*======================================================= Utility functions =======================================================*/
function delayToMs(delay) {
    if (typeof delay === "number") {
        return delay;
    }
    var millisecondsMatch = delay.match(/(\d+)\s*ms/);
    if (millisecondsMatch !== null) {
        return parseInt(millisecondsMatch[1], 10);
    }
    var secondsMatch = delay.match(/((\d+)|(\d*)(\.?)(\d+))\s*s/);
    if (secondsMatch !== null) {
        var hasDecimal = secondsMatch[4] !== undefined;
        if (!hasDecimal) {
            return parseInt(secondsMatch[2], 10) * 1000;
        }
        var secondsPart = !(secondsMatch[3] !== undefined)
            ? parseInt(secondsMatch[3], 10) * 1000
            : 0;
        var millisecondsPart = parseFloat("0.".concat(secondsMatch[5])) * 1000;
        millisecondsPart = Math.floor(millisecondsPart);
        if (millisecondsPart >= 1000) {
            throw new Error("Can't parse \"".concat(delay, " delay.\""));
        }
        return secondsPart + millisecondsPart;
    }
    throw new Error("Can't parse \"".concat(delay, " delay.\""));
}
function delayToS(delay) {
    var ms = delayToMs(delay);
    return ms / 1000;
}
function InvokedMachineFactory(machine, initContext) {
    return machine.withContext(initContext);
}
/*======================================================= Child Machines =======================================================*/
/*======================================================= Main Machine =======================================================*/
var pantilt = (0, xstate_1.createMachine)({
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
                                                            panTarget: function (context, event) {
                                                                return event.data.payload;
                                                            },
                                                        }),
                                                    ],
                                                },
                                                "invokeaction.moveTo": {
                                                    target: "#panToTarget",
                                                    actions: [
                                                        assign({
                                                            panTarget: function (context, event) {
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
                                                            pan_speed: function (context, event) {
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
                                                            pan_speed: function (context, event) {
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
                                                                            panPosition: function (context, event) {
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
                                                                            panPosition: function (context, event) {
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
                                                            panTarget: function (context, event) {
                                                                return event.data.payload;
                                                            },
                                                        }),
                                                    ],
                                                },
                                                "invokeaction.moveTo": {
                                                    target: "#panToTarget",
                                                    actions: [
                                                        assign({
                                                            panTarget: function (context, event) {
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
                                                            panPosition: function (context, event) {
                                                                return event.data.outputs["pos"];
                                                            },
                                                        }),
                                                        assign({ _panCon_responseReceived: true }),
                                                    ],
                                                    on: {
                                                        simulationStep: {
                                                            target: "#_panningContinuously_modelTickResponse",
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
                                                            tiltTarget: function (context, event) {
                                                                return event.data.payload;
                                                            },
                                                        }),
                                                    ],
                                                },
                                                "invokeaction.moveTo": {
                                                    target: "#tiltToTarget",
                                                    actions: [
                                                        assign({
                                                            tiltTarget: function (context, event) {
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
                                                            tilt_speed: function (context, event) {
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
                                                            tilt_speed: function (context, event) {
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
                                                                            tiltPosition: function (context, event) {
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
                                                                            tiltPosition: function (context, event) {
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
                                                            tiltTarget: function (context, event) {
                                                                return event.data.payload;
                                                            },
                                                        }),
                                                    ],
                                                },
                                                "invokeaction.moveTo": {
                                                    target: "#tiltToTarget",
                                                    actions: [
                                                        assign({
                                                            tiltTarget: function (context, event) {
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
                                                            tiltPosition: function (context, event) {
                                                                return event.data.outputs["pos"];
                                                            },
                                                        }),
                                                        assign({ _tiltCon_responseReceived: true }),
                                                    ],
                                                    on: {
                                                        simulationStep: {
                                                            target: "#_tiltingContinuously_modelTickResponse",
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
                                    delay: function (context, event, _a) {
                                        var _event = _a._event;
                                        var delayExpr = context["_stepSize"];
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
}, {
    actions: {
        wotResponse_0: function (context, event) {
            responseHandlerEmitter.emit("actionDone");
        },
        wotResponse_1: function (context, event) {
            responseHandlerEmitter.emit("actionDone");
        },
        wotSim_0: function (context, event) {
            ws0.send(JSON.stringify({
                simId: "panCon",
                messageType: "reset",
                stepSize: delayToS(context["_stepSize"]),
                parameters: {
                    speed: context["pan_speed"],
                    startPos: context["panPosition"],
                },
            }));
        },
        wotSim_1: function (context, event) {
            ws0.send(JSON.stringify({
                simId: "panCon",
                messageType: "step",
            }));
        },
        wotResponse_2: function (context, event) {
            responseHandlerEmitter.emit("actionDone");
        },
        wotResponse_3: function (context, event) {
            responseHandlerEmitter.emit("actionDone");
        },
        wotSim_2: function (context, event) {
            ws0.send(JSON.stringify({
                simId: "tiltCon",
                messageType: "reset",
                stepSize: delayToS(context["_stepSize"]),
                parameters: {
                    speed: context["tilt_speed"],
                    startPos: context["tiltPosition"],
                },
            }));
        },
        wotSim_3: function (context, event) {
            ws0.send(JSON.stringify({
                simId: "tiltCon",
                messageType: "step",
            }));
        },
    },
    guards: {
        clockCond: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            var stateString = JSON.stringify(service.getSnapshot().value);
            var reg = /_modelTickResponse/;
            return !reg.test(stateString);
        },
        cond_0: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.payload !== 0;
        },
        cond_1: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.payload.panSpeed !== 0;
        },
        cond_2: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["panTarget"] - context["panPosition"] >= 0;
        },
        cond_3: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["panPosition"] === context["panTarget"];
        },
        cond_4: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return (context["panPosition"] >= 90 && context["pan_speed"] > 0) ||
                (context["panPosition"] <= -90 && context["pan_speed"] < 0) ||
                context["pan_speed"] === 0;
        },
        cond_5: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.payload !== 0;
        },
        cond_6: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.payload.tiltSpeed !== 0;
        },
        cond_7: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["tiltTarget"] - context["tiltPosition"] >= 0;
        },
        cond_8: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["tiltPosition"] === context["tiltTarget"];
        },
        cond_9: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return (context["tiltPosition"] >= 80 && context["tilt_speed"] > 0) ||
                (context["tiltPosition"] <= -80 && context["tilt_speed"] < 0) ||
                context["tilt_speed"] === 0;
        },
    },
    delays: {},
    services: {},
});
var service = (0, xstate_1.interpret)(pantilt);
/*=================================================== node-wot ==================================================*/
var td = {
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
            description: "Moves the tilt and pan platform with the speeds given in input until a stop action is invoked or limits are reached",
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
            description: "Moves the tilt and pan platform to the angles given in input",
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
            description: "Moves the tilt platform with speed given in input until a stop action is invoked or limits are reached",
            idempotent: false,
            synchronous: false,
            input: {
                description: "The speed at which the platform moves. Negative values for moving up and positive values for moving down",
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
            description: "Moves the pan platform with speed given in input until a stop action is invoked or limits are reached",
            idempotent: false,
            synchronous: false,
            input: {
                description: "The speed at which the platform moves. Negative values for right and positive values for left",
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
            description: "Moves the tilt and pan platform with the speeds given in input until a stop action is invoked or limits are reached",
            idempotent: false,
            synchronous: false,
            input: {
                properties: {
                    panSpeed: {
                        description: "The speed at which the platform moves. Negative values for right and positive values for left",
                        maximum: 15,
                        minimum: -15,
                        type: "number",
                        unit: "angle per sec",
                    },
                    tiltSpeed: {
                        description: "The speed at which the tilt platform moves. Negative values for moving up and positive values for moving down",
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
            description: "Returns the pan and tilt to their home position which is at 0 and 0 degrees",
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
            description: "Stops any movement that was created with continuous movement calls",
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
var servient = new core_1.Servient();
servient.addServer(new binding_http_1.HttpServer());
servient.addClientFactory(new binding_http_1.HttpClientFactory());
core_1.Helpers.setStaticAddress("localhost");
servient.start().then(function (WoT) { return __awaiter(void 0, void 0, void 0, function () {
    var thing, lastState, lastContext;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, WoT.produce(td)];
            case 1:
                thing = _a.sent();
                /*============================================ Property Read Handlers ===========================================*/
                thing.setPropertyReadHandler("panPosition", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().context["panPosition"]];
                }); }); });
                thing.setPropertyReadHandler("tiltPosition", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().context["tiltPosition"]];
                }); }); });
                thing.setPropertyReadHandler("panState", function () { return service.getSnapshot().value["servos"]["panServo"]; });
                thing.setPropertyReadHandler("tiltState", function () { return service.getSnapshot().value["servos"]["tiltServo"]; });
                thing.setPropertyReadHandler("state", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().toJSON()];
                }); }); });
                /*=========================================== Property Write Handlers ===========================================*/
                /*============================================ Invoke Action Handlers ===========================================*/
                thing.setActionHandler("tiltTo", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, responsePromise, _a, _b, data;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!![
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
                                ].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction tiltTo is not accessible in current state");
                            case 1:
                                responsePromise = (0, events_1.once)(responseHandlerEmitter, "response.invokeaction.tiltTo");
                                _b = (_a = service).send;
                                _c = {
                                    type: "invokeaction.tiltTo"
                                };
                                _d = {};
                                return [4 /*yield*/, inputData.value()];
                            case 2:
                                _b.apply(_a, [(_c.data = (_d.payload = _e.sent(),
                                        _d.uriVariables = options === null || options === void 0 ? void 0 : options.uriVariables,
                                        _d),
                                        _c)]);
                                return [4 /*yield*/, responsePromise];
                            case 3:
                                data = (_e.sent())[0];
                                return [2 /*return*/, data];
                        }
                    });
                }); });
                thing.setActionHandler("panTo", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, responsePromise, _a, _b, data;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!![
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
                                ].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction panTo is not accessible in current state");
                            case 1:
                                responsePromise = (0, events_1.once)(responseHandlerEmitter, "response.invokeaction.panTo");
                                _b = (_a = service).send;
                                _c = {
                                    type: "invokeaction.panTo"
                                };
                                _d = {};
                                return [4 /*yield*/, inputData.value()];
                            case 2:
                                _b.apply(_a, [(_c.data = (_d.payload = _e.sent(),
                                        _d.uriVariables = options === null || options === void 0 ? void 0 : options.uriVariables,
                                        _d),
                                        _c)]);
                                return [4 /*yield*/, responsePromise];
                            case 3:
                                data = (_e.sent())[0];
                                return [2 /*return*/, data];
                        }
                    });
                }); });
                thing.setActionHandler("moveTo", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, _a, _b;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!![
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
                                ].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction moveTo is not accessible in current state");
                            case 1:
                                _b = (_a = service).send;
                                _c = {
                                    type: "invokeaction.moveTo"
                                };
                                _d = {};
                                return [4 /*yield*/, inputData.value()];
                            case 2:
                                _b.apply(_a, [(_c.data = (_d.payload = _e.sent(),
                                        _d.uriVariables = options === null || options === void 0 ? void 0 : options.uriVariables,
                                        _d),
                                        _c)]);
                                return [2 /*return*/, undefined];
                        }
                    });
                }); });
                thing.setActionHandler("tiltContinuously", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, _a, _b;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!![
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltToTarget",
                                ].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction tiltContinuously is not accessible in current state");
                            case 1:
                                _b = (_a = service).send;
                                _c = {
                                    type: "invokeaction.tiltContinuously"
                                };
                                _d = {};
                                return [4 /*yield*/, inputData.value()];
                            case 2:
                                _b.apply(_a, [(_c.data = (_d.payload = _e.sent(),
                                        _d.uriVariables = options === null || options === void 0 ? void 0 : options.uriVariables,
                                        _d),
                                        _c)]);
                                return [2 /*return*/, undefined];
                        }
                    });
                }); });
                thing.setActionHandler("panContinuously", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, _a, _b;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!![
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panToTarget",
                                ].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction panContinuously is not accessible in current state");
                            case 1:
                                _b = (_a = service).send;
                                _c = {
                                    type: "invokeaction.panContinuously"
                                };
                                _d = {};
                                return [4 /*yield*/, inputData.value()];
                            case 2:
                                _b.apply(_a, [(_c.data = (_d.payload = _e.sent(),
                                        _d.uriVariables = options === null || options === void 0 ? void 0 : options.uriVariables,
                                        _d),
                                        _c)]);
                                return [2 /*return*/, undefined];
                        }
                    });
                }); });
                thing.setActionHandler("moveContinuously", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, _a, _b;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!![
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.panServo.panToTarget",
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
                                    "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltToTarget",
                                ].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction moveContinuously is not accessible in current state");
                            case 1:
                                _b = (_a = service).send;
                                _c = {
                                    type: "invokeaction.moveContinuously"
                                };
                                _d = {};
                                return [4 /*yield*/, inputData.value()];
                            case 2:
                                _b.apply(_a, [(_c.data = (_d.payload = _e.sent(),
                                        _d.uriVariables = options === null || options === void 0 ? void 0 : options.uriVariables,
                                        _d),
                                        _c)]);
                                return [2 /*return*/, undefined];
                        }
                    });
                }); });
                thing.setActionHandler("goHome", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState;
                    return __generator(this, function (_a) {
                        currentState = service.getSnapshot();
                        if (![
                            "_wotwrapper._wotMachinewrapper.servos.panServo.panIdle",
                            "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
                            "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltIdle",
                            "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
                        ].some(currentState.matches)) {
                            throw new Error("invokeaction goHome is not accessible in current state");
                        }
                        else {
                            service.send({
                                type: "invokeaction.goHome",
                                // data: {
                                //   payload: await inputData.value(),
                                //   uriVariables: options?.uriVariables,
                                // },
                            });
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/];
                    });
                }); });
                thing.setActionHandler("stopMovement", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState;
                    return __generator(this, function (_a) {
                        currentState = service.getSnapshot();
                        if (![
                            "_wotwrapper._wotMachinewrapper.servos.panServo.panningContinuously",
                            "_wotwrapper._wotMachinewrapper.servos.tiltServo.tiltingContinuously",
                        ].some(currentState.matches)) {
                            throw new Error("invokeaction stopMovement is not accessible in current state");
                        }
                        else {
                            service.send({
                                type: "invokeaction.stopMovement",
                                // data: {
                                //   payload: await inputData.value(),
                                //   uriVariables: options?.uriVariables,
                                // },
                            });
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/];
                    });
                }); });
                /*================================================ Event Emitters ===============================================*/
                responseHandlerEmitter.on("actionDone", function (data) {
                    thing.emitEvent("actionDone", data);
                });
                service.onTransition(function (state) {
                    console.log("".concat(td.title, ":"));
                    console.log("Recieved Event: ".concat(JSON.stringify(state.event)));
                    console.log("Current State: ".concat(JSON.stringify(state.value)));
                    if (lastContext !== undefined &&
                        lastContext["panPosition"] !== state.context["panPosition"])
                        thing.emitPropertyChange("panPosition");
                    if (lastContext !== undefined &&
                        lastContext["tiltPosition"] !== state.context["tiltPosition"])
                        thing.emitPropertyChange("tiltPosition");
                    lastState = state;
                    lastContext = state.context;
                });
                //Start State Machine and Server
                service.start();
                thing.expose();
                return [2 /*return*/];
        }
    });
}); });
ws0.on("message", function (responseMessage) {
    var response = JSON.parse(responseMessage);
    var simId = response.simId;
    service.send({
        type: "_sim_".concat(simId, ".response"),
        data: response,
    });
});
