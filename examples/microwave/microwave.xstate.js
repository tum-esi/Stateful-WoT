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
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@node-wot/core");
var binding_http_1 = require("@node-wot/binding-http");
var events_1 = require("events");
var ResponseHandlerEmitter = /** @class */ (function (_super) {
    __extends(ResponseHandlerEmitter, _super);
    function ResponseHandlerEmitter() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ResponseHandlerEmitter;
}(events_1.EventEmitter));
var responseHandlerEmitter = new ResponseHandlerEmitter();
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
var machine = (0, xstate_1.createMachine)({
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
                                            timer: function (context, event) {
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
}, {
    actions: {
        wotResponse_0: function (context, event) {
            responseHandlerEmitter.emit("turn.off.done");
        },
        wotResponse_1: function (context, event) {
            responseHandlerEmitter.emit("turn.on.done");
        },
        wotResponse_2: function (context, event) {
            responseHandlerEmitter.emit("cooking.done");
        },
    },
    guards: {
        cond_0: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["timer"] >= context["cook_time"];
        },
        cond_1: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["door_closed"];
        },
    },
    delays: {},
    services: {},
});
var service = (0, xstate_1.interpret)(machine);
/*=================================================== node-wot ==================================================*/
var td = {
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
                thing.setPropertyReadHandler("microwaveState", function () { return service.getSnapshot().value["microwave"]; });
                thing.setPropertyReadHandler("operationState", function () { return service.getSnapshot().value["microwave"]["on"]; });
                thing.setPropertyReadHandler("state", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().toJSON()];
                }); }); });
                thing.setPropertyReadHandler("operationState", function () { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState;
                    return __generator(this, function (_a) {
                        currentState = service.getSnapshot();
                        if (!["microwave.on"].some(currentState.matches)) {
                            throw new Error("readproperty operationState is not accessible in current state");
                        }
                        else {
                            return [2 /*return*/, service.getSnapshot().value["microwave"]["on"]];
                        }
                        return [2 /*return*/];
                    });
                }); });
                /*=========================================== Property Write Handlers ===========================================*/
                /*============================================ Invoke Action Handlers ===========================================*/
                thing.setActionHandler("turnOn", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, responsePromise, data;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!!["microwave.off"].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction turnOn is not accessible in current state");
                            case 1:
                                responsePromise = (0, events_1.once)(responseHandlerEmitter, "turn.on.done");
                                service.send({ type: "turn.on" });
                                return [4 /*yield*/, responsePromise];
                            case 2:
                                data = (_a.sent())[0];
                                return [2 /*return*/, data];
                        }
                    });
                }); });
                thing.setActionHandler("turnOff", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, responsePromise, data;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!!["microwave.on"].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction turnOff is not accessible in current state");
                            case 1:
                                responsePromise = (0, events_1.once)(responseHandlerEmitter, "turn.off.done");
                                service.send({ type: "turn.off" });
                                return [4 /*yield*/, responsePromise];
                            case 2:
                                data = (_a.sent())[0];
                                return [2 /*return*/, data];
                        }
                    });
                }); });
                thing.setActionHandler("step", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState;
                    return __generator(this, function (_a) {
                        currentState = service.getSnapshot();
                        if (!["microwave.on.cooking"].some(currentState.matches)) {
                            throw new Error("invokeaction step is not accessible in current state");
                        }
                        else {
                            service.send({ type: "time" });
                            return [2 /*return*/, undefined];
                        }
                        return [2 /*return*/];
                    });
                }); });
                /*================================================ Event Emitters ===============================================*/
                responseHandlerEmitter.on("cooking.done", function (data) {
                    thing.emitEvent("cookingDone", data);
                });
                service.onTransition(function (state) {
                    console.log("".concat(td.title, ":"));
                    console.log("Recieved Event: ".concat(JSON.stringify(state.event)));
                    console.log("Current State: ".concat(JSON.stringify(state.value)));
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
