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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
        var hasDecimal = !(secondsMatch[4] !== undefined);
        if (!hasDecimal) {
            return parseInt(secondsMatch[2], 10) * 1000;
        }
        var secondsPart = !(secondsMatch[3] !== undefined)
            ? parseInt(secondsMatch[1], 10) * 1000
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
function InvokedMachineFactory(machine, initContext) {
    return machine.withContext(initContext);
}
/*======================================================= Child Machines =======================================================*/
var machine_0 = (0, xstate_1.createMachine)({
    id: "brewingTask",
    initial: "init",
    context: {
        def: { drinkId: "americano", size: "m", quantity: 1 },
        remainingQuantity: 1,
        sizeQuantifiers: { s: 1, m: 2, l: 3 },
        drinkRecipes: {
            espresso: { water: 1, milk: 0, chocolate: 0, coffeeBeans: 2 },
            americano: { water: 2, milk: 0, chocolate: 0, coffeeBeans: 2 },
            cappuccino: { water: 1, milk: 1, chocolate: 0, coffeeBeans: 2 },
            latte: { water: 1, milk: 2, chocolate: 0, coffeeBeans: 2 },
            hotChocolate: { water: 1, milk: 0, chocolate: 1, coffeeBeans: 0 },
            hotWater: { water: 1, milk: 0, chocolate: 0, coffeeBeans: 0 },
        },
        grindingTimes: { l: "10s", m: "8s", s: "5s" },
        pouringTimes: { l: "4s", m: "3s", s: "2s" },
        brewingTimes: {
            espresso: "60s",
            americano: "60s",
            cappuccino: "60s",
            latte: "60s",
        },
        heatingTime: { s: "5s", m: "7s", l: "10s" },
        currentMilk: undefined,
        currentWater: undefined,
        currentChocolate: undefined,
        currentCoffeeBeans: undefined,
        coffeeTask: undefined,
    },
    states: {
        init: {
            id: "init",
            initial: undefined,
            entry: [
                {
                    type: "xstate.choose",
                    conds: [
                        {
                            actions: [
                                assign({
                                    coffeeTask: function (context, event) {
                                        return context["def"];
                                    },
                                }),
                            ],
                            cond: "cond_0",
                        },
                        {
                            actions: [
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                assign(function (context, event) {
                                                    var update = {};
                                                    update["coffeeTask"] = __assign({}, context["coffeeTask"]);
                                                    update["coffeeTask"].drinkId =
                                                        context["def"].drinkId;
                                                    return update;
                                                }),
                                            ],
                                            cond: "cond_1",
                                        },
                                    ],
                                },
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                assign(function (context, event) {
                                                    var update = {};
                                                    update["coffeeTask"] = __assign({}, context["coffeeTask"]);
                                                    update["coffeeTask"].size = context["def"].size;
                                                    return update;
                                                }),
                                            ],
                                            cond: "cond_2",
                                        },
                                    ],
                                },
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                assign(function (context, event) {
                                                    var update = {};
                                                    update["coffeeTask"] = __assign({}, context["coffeeTask"]);
                                                    update["coffeeTask"].quantity =
                                                        context["def"].quantity;
                                                    return update;
                                                }),
                                            ],
                                            cond: "cond_3",
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
            always: [{ target: "#checking" }],
            exit: [
                assign({
                    remainingQuantity: function (context, event) {
                        return context["coffeeTask"].quantity;
                    },
                }),
            ],
        },
        checking: {
            id: "checking",
            initial: undefined,
            entry: [
                {
                    type: "xstate.choose",
                    conds: [
                        {
                            actions: [
                                send(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "coffeeBeans",
                                    });
                                }),
                            ],
                            cond: "cond_4",
                        },
                        {
                            actions: [
                                send(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "milk",
                                    });
                                }),
                            ],
                            cond: "cond_5",
                        },
                        {
                            actions: [
                                send(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "water",
                                    });
                                }),
                            ],
                            cond: "cond_6",
                        },
                        {
                            actions: [
                                send(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "chocolate",
                                    });
                                }),
                            ],
                            cond: "cond_7",
                        },
                        { actions: [send("sendResourcesOK")] },
                    ],
                },
            ],
            on: {
                outOfResource: { target: "#outOfResource" },
                sendResourcesOK: { target: "#checkOk" },
            },
        },
        checkOk: {
            id: "checkOk",
            initial: undefined,
            always: [
                { target: "#heatingWater", cond: "cond_8" },
                { target: "#grinding", cond: "cond_9" },
            ],
        },
        outOfResource: {
            id: "outOfResource",
            type: "final",
            entry: [
                {
                    type: "xstate.choose",
                    conds: [
                        {
                            actions: [
                                (0, xstate_1.sendParent)(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "coffeeBeans",
                                    });
                                }),
                            ],
                            cond: "cond_10",
                        },
                        {
                            actions: [
                                (0, xstate_1.sendParent)(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "water",
                                    });
                                }),
                            ],
                            cond: "cond_11",
                        },
                        {
                            actions: [
                                (0, xstate_1.sendParent)(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "milk",
                                    });
                                }),
                            ],
                            cond: "cond_12",
                        },
                        {
                            actions: [
                                (0, xstate_1.sendParent)(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "outOfResource",
                                        data: "chocolate",
                                    });
                                }),
                            ],
                            cond: "cond_13",
                        },
                    ],
                },
            ],
        },
        grinding: {
            id: "grinding",
            initial: undefined,
            entry: [
                {
                    type: "xstate.choose",
                    conds: [
                        {
                            actions: [
                                (0, xstate_1.sendParent)(function (context, event, _a) {
                                    var _event = _a._event;
                                    return ({
                                        type: "updateResource.coffeeBeans",
                                        data: {
                                            payload: context["sizeQuantifiers"][context["coffeeTask"].size] *
                                                context["drinkRecipes"][context["coffeeTask"].drinkId]
                                                    .coffeeBeans,
                                        },
                                    });
                                }),
                                assign({
                                    currentCoffeeBeans: function (context, event) {
                                        return (context["currentCoffeeBeans"] -
                                            context["sizeQuantifiers"][context["coffeeTask"].size] *
                                                context["drinkRecipes"][context["coffeeTask"].drinkId]
                                                    .coffeeBeans);
                                    },
                                }),
                                send("grinded", {
                                    delay: function (context, event, _a) {
                                        var _event = _a._event;
                                        var delayExpr = context["grindingTimes"][context["coffeeTask"].size];
                                        return delayToMs(delayExpr);
                                    },
                                }),
                            ],
                            cond: "cond_14",
                        },
                    ],
                },
            ],
            on: { grinded: { target: "#heatingWater" } },
        },
        heatingWater: {
            id: "heatingWater",
            initial: undefined,
            entry: [
                (0, xstate_1.sendParent)(function (context, event, _a) {
                    var _event = _a._event;
                    return ({
                        type: "updateResource.water",
                        data: {
                            payload: context["sizeQuantifiers"][context["coffeeTask"].size] *
                                context["drinkRecipes"][context["coffeeTask"].drinkId].water,
                        },
                    });
                }),
                assign({
                    currentWater: function (context, event) {
                        return (context["currentWater"] -
                            context["sizeQuantifiers"][context["coffeeTask"].size] *
                                context["drinkRecipes"][context["coffeeTask"].drinkId].water);
                    },
                }),
                send("waterHeated", {
                    delay: function (context, event, _a) {
                        var _event = _a._event;
                        var delayExpr = context["heatingTime"][context["coffeeTask"].size];
                        return delayToMs(delayExpr);
                    },
                }),
            ],
            on: {
                waterHeated: [
                    { target: "#brewing", cond: "cond_15" },
                    { target: "#pouring", cond: "cond_16" },
                    { target: "#addChocolate", cond: "cond_17" },
                ],
            },
        },
        brewing: {
            id: "brewing",
            initial: undefined,
            entry: [
                send("brewed", {
                    delay: function (context, event, _a) {
                        var _event = _a._event;
                        var delayExpr = context["brewingTimes"][context["coffeeTask"].drinkId];
                        return delayToMs(delayExpr);
                    },
                }),
            ],
            on: {
                brewed: [
                    { target: "#heatingMilk", cond: "cond_18" },
                    { target: "#pouring", cond: "cond_19" },
                ],
            },
        },
        addChocolate: {
            id: "addChocolate",
            initial: undefined,
            entry: [
                (0, xstate_1.sendParent)(function (context, event, _a) {
                    var _event = _a._event;
                    return ({
                        type: "updateResource.chocolate",
                        data: {
                            payload: context["sizeQuantifiers"][context["coffeeTask"].size] *
                                context["drinkRecipes"][context["coffeeTask"].drinkId]
                                    .chocolate,
                        },
                    });
                }),
                assign({
                    currentChocolate: function (context, event) {
                        return (context["currentChocolate"] -
                            context["sizeQuantifiers"][context["coffeeTask"].size] *
                                context["drinkRecipes"][context["coffeeTask"].drinkId]
                                    .chocolate);
                    },
                }),
                send("chocolateAdded", { delay: 8000 }),
            ],
            on: { chocolateAdded: { target: "#pouring" } },
        },
        heatingMilk: {
            id: "heatingMilk",
            initial: undefined,
            entry: [
                (0, xstate_1.sendParent)(function (context, event, _a) {
                    var _event = _a._event;
                    return ({
                        type: "updateResource.milk",
                        data: {
                            payload: context["sizeQuantifiers"][context["coffeeTask"].size] *
                                context["drinkRecipes"][context["coffeeTask"].drinkId].milk,
                        },
                    });
                }),
                assign({
                    currentMilk: function (context, event) {
                        return (context["currentMilk"] -
                            context["sizeQuantifiers"][context["coffeeTask"].size] *
                                context["drinkRecipes"][context["coffeeTask"].drinkId].milk);
                    },
                }),
                send("milkHeated", {
                    delay: function (context, event, _a) {
                        var _event = _a._event;
                        var delayExpr = context["heatingTime"][context["coffeeTask"].size];
                        return delayToMs(delayExpr);
                    },
                }),
            ],
            on: { milkHeated: { target: "#pouring" } },
        },
        pouring: {
            id: "pouring",
            initial: undefined,
            entry: [
                send("poured", {
                    delay: function (context, event, _a) {
                        var _event = _a._event;
                        var delayExpr = context["pouringTimes"][context["coffeeTask"].size];
                        return delayToMs(delayExpr);
                    },
                }),
                assign({
                    remainingQuantity: function (context, event) {
                        return context["remainingQuantity"] - 1;
                    },
                }),
            ],
            on: {
                poured: [
                    { target: "#checking", cond: "cond_20" },
                    { target: "#finished", cond: "cond_21" },
                ],
            },
        },
        finished: { id: "finished", type: "final" },
    },
}, {
    actions: {},
    guards: {
        cond_0: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"] === undefined;
        },
        cond_1: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].drinkId === undefined;
        },
        cond_2: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].size === undefined;
        },
        cond_3: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].quantity === undefined;
        },
        cond_4: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["currentCoffeeBeans"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                    context["drinkRecipes"][context["coffeeTask"].drinkId].coffeeBeans <
                0;
        },
        cond_5: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["currentMilk"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                    context["drinkRecipes"][context["coffeeTask"].drinkId].milk <
                0;
        },
        cond_6: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["currentWater"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                    context["drinkRecipes"][context["coffeeTask"].drinkId].water <
                0;
        },
        cond_7: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["currentChocolate"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                    context["drinkRecipes"][context["coffeeTask"].drinkId].chocolate <
                0;
        },
        cond_8: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].drinkId === "hotWater" ||
                context["coffeeTask"].drinkId === "hotChocolate";
        },
        cond_9: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].drinkId !== "hotWater" &&
                context["coffeeTask"].drinkId !== "hotChocolate";
        },
        cond_10: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data === "coffeeBeans";
        },
        cond_11: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data === "water";
        },
        cond_12: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data === "milk";
        },
        cond_13: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data === "chocolate";
        },
        cond_14: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"] !== undefined;
        },
        cond_15: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["drinkRecipes"][context["coffeeTask"].drinkId].coffeeBeans !==
                0;
        },
        cond_16: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].drinkId === "hotWater";
        },
        cond_17: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["coffeeTask"].drinkId === "hotChocolate";
        },
        cond_18: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["drinkRecipes"][context["coffeeTask"].drinkId].milk !== 0;
        },
        cond_19: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["drinkRecipes"][context["coffeeTask"].drinkId].milk === 0;
        },
        cond_20: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["remainingQuantity"] > 0;
        },
        cond_21: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["remainingQuantity"] === 0;
        },
    },
    delays: {},
    services: {},
});
/*======================================================= Main Machine =======================================================*/
var coffeeMachine = (0, xstate_1.createMachine)({
    id: "coffeeMachine",
    initial: "wrapper",
    context: {
        allAvailableResources: {
            milk: 100,
            water: 100,
            chocolate: 100,
            coffeeBeans: 100,
        },
        possibleDrinks: [
            "espresso",
            "americano",
            "cappuccino",
            "latte",
            "hotChocolate",
            "hotWater",
        ],
        servedCounter: 0,
        maintenanceNeeded: false,
        currentTask: undefined,
        schedules: [],
        _spawnedServices: {},
        _spawnedServicesCounter: 0,
    },
    states: {
        wrapper: {
            id: "wrapper",
            type: "parallel",
            states: {
                resourceUpdate: {
                    id: "resourceUpdate",
                    initial: undefined,
                    on: {
                        "*": [
                            {
                                target: "#resourceUpdate",
                                cond: "cond_0",
                                actions: [
                                    assign(function (context, event) {
                                        var update = {};
                                        update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                        update["allAvailableResources"].coffeeBeans =
                                            context["allAvailableResources"].coffeeBeans -
                                                event.data.payload;
                                        return update;
                                    }),
                                ],
                            },
                            {
                                target: "#resourceUpdate",
                                cond: "cond_1",
                                actions: [
                                    assign(function (context, event) {
                                        var update = {};
                                        update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                        update["allAvailableResources"].water =
                                            context["allAvailableResources"].water -
                                                event.data.payload;
                                        return update;
                                    }),
                                ],
                            },
                            {
                                target: "#resourceUpdate",
                                cond: "cond_2",
                                actions: [
                                    assign(function (context, event) {
                                        var update = {};
                                        update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                        update["allAvailableResources"].milk =
                                            context["allAvailableResources"].milk -
                                                event.data.payload;
                                        return update;
                                    }),
                                ],
                            },
                            {
                                target: "#resourceUpdate",
                                cond: "cond_3",
                                actions: [
                                    assign(function (context, event) {
                                        var update = {};
                                        update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                        update["allAvailableResources"].chocolate =
                                            context["allAvailableResources"].chocolate -
                                                event.data.payload;
                                        return update;
                                    }),
                                ],
                            },
                        ],
                    },
                },
                eventEmitter: {
                    id: "eventEmitter",
                    initial: undefined,
                    on: {
                        outOfResource: {
                            target: "#eventEmitter",
                            actions: ["wotResponse_0"],
                        },
                        "*": {
                            target: "#eventEmitter",
                            cond: "cond_4",
                            actions: ["wotResponse_1"],
                        },
                    },
                },
                coffeeOutlet: {
                    id: "coffeeOutlet",
                    initial: "idle",
                    states: {
                        idle: {
                            id: "idle",
                            initial: undefined,
                            on: {
                                taskReceived: { target: "#busy" },
                                refill: { target: "#refilling" },
                            },
                        },
                        busy: {
                            id: "busy",
                            initial: undefined,
                            entry: assign({
                                currentTask: function (context, event) {
                                    return "busy.".concat(context._spawnedServicesCounter);
                                },
                                _spawnedServices: function (context, event) {
                                    var tmp = __assign({}, context._spawnedServices);
                                    tmp["busy.".concat(context._spawnedServicesCounter)] = (0, xstate_1.spawn)(InvokedMachineFactory(machine_0, {
                                        def: { drinkId: "americano", size: "m", quantity: 1 },
                                        remainingQuantity: 1,
                                        sizeQuantifiers: { s: 1, m: 2, l: 3 },
                                        drinkRecipes: {
                                            espresso: {
                                                water: 1,
                                                milk: 0,
                                                chocolate: 0,
                                                coffeeBeans: 2,
                                            },
                                            americano: {
                                                water: 2,
                                                milk: 0,
                                                chocolate: 0,
                                                coffeeBeans: 2,
                                            },
                                            cappuccino: {
                                                water: 1,
                                                milk: 1,
                                                chocolate: 0,
                                                coffeeBeans: 2,
                                            },
                                            latte: {
                                                water: 1,
                                                milk: 2,
                                                chocolate: 0,
                                                coffeeBeans: 2,
                                            },
                                            hotChocolate: {
                                                water: 1,
                                                milk: 0,
                                                chocolate: 1,
                                                coffeeBeans: 0,
                                            },
                                            hotWater: {
                                                water: 1,
                                                milk: 0,
                                                chocolate: 0,
                                                coffeeBeans: 0,
                                            },
                                        },
                                        grindingTimes: { l: "10s", m: "8s", s: "5s" },
                                        pouringTimes: { l: "4s", m: "3s", s: "2s" },
                                        brewingTimes: {
                                            espresso: "60s",
                                            americano: "60s",
                                            cappuccino: "60s",
                                            latte: "60s",
                                        },
                                        heatingTime: { s: "5s", m: "7s", l: "10s" },
                                        currentMilk: context["allAvailableResources"].milk,
                                        currentWater: context["allAvailableResources"].water,
                                        currentChocolate: context["allAvailableResources"].chocolate,
                                        currentCoffeeBeans: context["allAvailableResources"].coffeeBeans,
                                        coffeeTask: event.data.payload,
                                    }), "busy.".concat(context._spawnedServicesCounter));
                                    return tmp;
                                },
                                _spawnedServicesCounter: function (context, event) {
                                    return context._spawnedServicesCounter + 1;
                                },
                            }),
                            exit: stop(function (context) { return context["currentTask"]; }),
                            on: { "*": { target: "#idle", cond: "cond_5" } },
                        },
                        refilling: {
                            id: "refilling",
                            initial: undefined,
                            entry: [
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                {
                                                    type: "xstate.choose",
                                                    conds: [
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].coffeeBeans = 100;
                                                                    return update;
                                                                }),
                                                            ],
                                                            cond: "cond_7",
                                                        },
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].coffeeBeans =
                                                                        context["allAvailableResources"]
                                                                            .coffeeBeans + event.data.payload;
                                                                    return update;
                                                                }),
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                            cond: "cond_6",
                                        },
                                    ],
                                },
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                {
                                                    type: "xstate.choose",
                                                    conds: [
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].water = 100;
                                                                    return update;
                                                                }),
                                                            ],
                                                            cond: "cond_9",
                                                        },
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].water =
                                                                        context["allAvailableResources"].water +
                                                                            event.data.payload;
                                                                    return update;
                                                                }),
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                            cond: "cond_8",
                                        },
                                    ],
                                },
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                {
                                                    type: "xstate.choose",
                                                    conds: [
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].milk = 100;
                                                                    return update;
                                                                }),
                                                            ],
                                                            cond: "cond_11",
                                                        },
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].milk =
                                                                        context["allAvailableResources"].milk +
                                                                            event.data.payload;
                                                                    return update;
                                                                }),
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                            cond: "cond_10",
                                        },
                                    ],
                                },
                                {
                                    type: "xstate.choose",
                                    conds: [
                                        {
                                            actions: [
                                                {
                                                    type: "xstate.choose",
                                                    conds: [
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].chocolate = 100;
                                                                    return update;
                                                                }),
                                                            ],
                                                            cond: "cond_13",
                                                        },
                                                        {
                                                            actions: [
                                                                assign(function (context, event) {
                                                                    var update = {};
                                                                    update["allAvailableResources"] = __assign({}, context["allAvailableResources"]);
                                                                    update["allAvailableResources"].chocolate =
                                                                        context["allAvailableResources"]
                                                                            .chocolate + event.data.payload;
                                                                    return update;
                                                                }),
                                                            ],
                                                        },
                                                    ],
                                                },
                                            ],
                                            cond: "cond_12",
                                        },
                                    ],
                                },
                                send("refilled", { delay: 10000 }),
                            ],
                            on: {
                                refilled: { target: "#idle", actions: ["wotResponse_2"] },
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
            responseHandlerEmitter.emit("outOfResource", event.data);
        },
        wotResponse_1: function (context, event) {
            responseHandlerEmitter.emit("taskDone");
        },
        wotResponse_2: function (context, event) {
            responseHandlerEmitter.emit("refilled");
        },
    },
    guards: {
        cond_0: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.type.includes("update") && event.type.endsWith("coffeeBeans");
        },
        cond_1: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.type.includes("update") && event.type.endsWith("water");
        },
        cond_2: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.type.includes("update") && event.type.endsWith("milk");
        },
        cond_3: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.type.includes("update") && event.type.endsWith("chocolate");
        },
        cond_4: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.type.includes("done.invoke");
        },
        cond_5: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.type.includes("done.invoke");
        },
        cond_6: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.uriVariables.id === "coffeeBeans";
        },
        cond_7: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["allAvailableResources"].coffeeBeans + event.data.payload > 100;
        },
        cond_8: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.uriVariables.id === "water";
        },
        cond_9: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["allAvailableResources"].water + event.data.payload > 100;
        },
        cond_10: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.uriVariables.id === "milk";
        },
        cond_11: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["allAvailableResources"].milk + event.data.payload > 100;
        },
        cond_12: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return event.data.uriVariables.id === "chocolate";
        },
        cond_13: function (context, event, _a) {
            var cond = _a.cond, _event = _a._event;
            return context["allAvailableResources"].chocolate + event.data.payload > 100;
        },
    },
    delays: {},
    services: {},
});
var service = (0, xstate_1.interpret)(coffeeMachine);
/*=================================================== node-wot ==================================================*/
var td = {
    "@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
    "@type": "Thing",
    title: "machine",
    description: "",
    properties: {
        allAvailableResources: {
            type: "object",
            description: "Current level of all available resources given as an integer percentage for each particular resource.\nThe data is obtained from the machine's sensors but can be set manually via the availableResourceLevel property in case the sensors are broken.",
            readOnly: true,
            properties: {
                water: { type: "integer", minimum: 0, maximum: 100 },
                milk: { type: "integer", minimum: 0, maximum: 100 },
                chocolate: { type: "integer", minimum: 0, maximum: 100 },
                coffeeBeans: { type: "integer", minimum: 0, maximum: 100 },
            },
            writeOnly: false,
            observable: false,
        },
        status: {
            title: "coffeeOutlet",
            description: "Exposed State coffeeOutlet",
            type: "string",
            enum: ["idle", "busy", "refilling"],
        },
        possibleDrinks: {
            type: "array",
            description: "The list of possible drinks in general. Doesn't depend on the available resources.",
            readOnly: true,
            items: { type: "string" },
        },
        availableResourceLevel: {
            readOnly: true,
            uriVariables: {
                id: {
                    type: "string",
                    enum: ["milk", "water", "chocolate", "coffeeBeans"],
                },
            },
            type: "number",
        },
        state: { type: "object", readOnly: true },
    },
    actions: {
        makeDrink: {
            description: "Make a drink from available list of beverages. Accepts drink id, size and quantity as uriVariables.\n Brews one medium americano if no uriVariables are specified.",
            input: {
                drinkId: {
                    type: "string",
                    description: "Defines what drink to make, drinkId is one of possibleDrinks property values, e.g. latte.",
                },
                size: {
                    type: "string",
                    description: "Defines the size of a drink, s = small, m = medium, l = large.",
                    enum: ["s", "m", "l"],
                },
                quantity: {
                    type: "integer",
                    description: "Defines how many drinks to make, ranging from 1 to 5.",
                    minimum: 1,
                    maximum: 5,
                },
                synchronous: true,
            },
            "scxml:action": {
                invokeaction: { event: "taskReceived", availableInState: ["idle"] },
            },
        },
        refillResource: {
            description: "Action used to refill a specific resource in the coffee machine",
            uriVariables: {
                id: {
                    description: "ID of the resource to refill",
                    type: "string",
                    enum: ["water", "milk", "chocolate", "coffeeBeans"],
                },
            },
            input: {
                description: "The amount of the resource used to refill. It is added to the current resource level",
                type: "number",
                minimum: 0,
                maximum: 100,
            },
            synchronous: true,
            "scxml:action": {
                invokeaction: { event: "refill", availableInState: ["idle"] },
            },
        },
    },
    events: {
        outOfResource: {
            description: "Out of resource event. Emitted when the available resource level is not sufficient for a desired drink.",
            data: {
                type: "string",
                enum: ["coffeeBeans", "water", "milk", "chocolate"],
            },
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
                thing.setPropertyReadHandler("allAvailableResources", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().context["allAvailableResources"]];
                }); }); });
                thing.setPropertyReadHandler("status", function () { return service.getSnapshot().value["wrapper"]["coffeeOutlet"]; });
                thing.setPropertyReadHandler("possibleDrinks", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().context["possibleDrinks"]];
                }); }); });
                thing.setPropertyReadHandler("availableResourceLevel", function (options) {
                    if (options && typeof options === "object" && options.uriVariables) {
                        var uriVariables = options.uriVariables;
                        if (uriVariables["id"]) {
                            var id = uriVariables["id"];
                            return service.getSnapshot().context["allAvailableResources"][id];
                        }
                    }
                });
                thing.setPropertyReadHandler("state", function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, service.getSnapshot().toJSON()];
                }); }); });
                /*=========================================== Property Write Handlers ===========================================*/
                /*============================================ Invoke Action Handlers ===========================================*/
                thing.setActionHandler("makeDrink", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, responsePromise, _a, _b, data;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!!["wrapper.coffeeOutlet.idle"].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction makeDrink is not accessible in current state");
                            case 1:
                                responsePromise = (0, events_1.once)(responseHandlerEmitter, "taskDone");
                                _b = (_a = service).send;
                                _c = {
                                    type: "taskReceived"
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
                thing.setActionHandler("refillResource", function (inputData, options) { return __awaiter(void 0, void 0, void 0, function () {
                    var currentState, responsePromise, _a, _b, data;
                    var _c, _d;
                    return __generator(this, function (_e) {
                        switch (_e.label) {
                            case 0:
                                currentState = service.getSnapshot();
                                if (!!["wrapper.coffeeOutlet.idle"].some(currentState.matches)) return [3 /*break*/, 1];
                                throw new Error("invokeaction refillResource is not accessible in current state");
                            case 1:
                                responsePromise = (0, events_1.once)(responseHandlerEmitter, "refilled");
                                _b = (_a = service).send;
                                _c = {
                                    type: "refill"
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
                /*================================================ Event Emitters ===============================================*/
                responseHandlerEmitter.on("outOfResource", function (data) {
                    thing.emitEvent("outOfResource", data);
                });
                service.onTransition(function (state, context) {
                    console.log("".concat(td.title, ":"));
                    console.log("Recieved Event: ".concat(JSON.stringify(state.event)));
                    console.log("Current State: ".concat(JSON.stringify(state.value)));
                    lastState = state;
                    lastContext = context;
                });
                //Start State Machine and Server
                service.start();
                thing.expose();
                return [2 /*return*/];
        }
    });
}); });
