import { Servient, Helpers } from "@node-wot/core";
import {
  HttpServer,
  HttpClientFactory,
  HttpsClientFactory,
} from "@node-wot/binding-http";
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
    const hasDecimal = !(secondsMatch[4] !== undefined);
    if (!hasDecimal) {
      return parseInt(secondsMatch[2], 10) * 1000;
    }

    const secondsPart = !(secondsMatch[3] !== undefined)
      ? parseInt(secondsMatch[1], 10) * 1000
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

function InvokedMachineFactory(
  machine: AnyStateMachine,
  initContext: any
): AnyStateMachine {
  return machine.withContext(initContext);
}

/*======================================================= Child Machines =======================================================*/

let machine_0 = createMachine(
  {
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
                    coffeeTask: (context: any, event: any) => {
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
                          assign((context: any, event: any) => {
                            const update: Record<string, any> = {};
                            update["coffeeTask"] = { ...context["coffeeTask"] };
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
                          assign((context: any, event: any) => {
                            const update: Record<string, any> = {};
                            update["coffeeTask"] = { ...context["coffeeTask"] };
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
                          assign((context: any, event: any) => {
                            const update: Record<string, any> = {};
                            update["coffeeTask"] = { ...context["coffeeTask"] };
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
            remainingQuantity: (context: any, event: any) => {
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
                  send((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "coffeeBeans",
                  })),
                ],
                cond: "cond_4",
              },
              {
                actions: [
                  send((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "milk",
                  })),
                ],
                cond: "cond_5",
              },
              {
                actions: [
                  send((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "water",
                  })),
                ],
                cond: "cond_6",
              },
              {
                actions: [
                  send((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "chocolate",
                  })),
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
                  sendParent((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "coffeeBeans",
                  })),
                ],
                cond: "cond_10",
              },
              {
                actions: [
                  sendParent((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "water",
                  })),
                ],
                cond: "cond_11",
              },
              {
                actions: [
                  sendParent((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "milk",
                  })),
                ],
                cond: "cond_12",
              },
              {
                actions: [
                  sendParent((context: any, event: any, { _event }) => ({
                    type: "outOfResource",
                    data: "chocolate",
                  })),
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
                  sendParent((context: any, event: any, { _event }) => ({
                    type: "updateResource.coffeeBeans",
                    data: {
                      payload:
                        context["sizeQuantifiers"][context["coffeeTask"].size] *
                        context["drinkRecipes"][context["coffeeTask"].drinkId]
                          .coffeeBeans,
                    },
                  })),
                  assign({
                    currentCoffeeBeans: (context: any, event: any) => {
                      return (
                        context["currentCoffeeBeans"] -
                        context["sizeQuantifiers"][context["coffeeTask"].size] *
                          context["drinkRecipes"][context["coffeeTask"].drinkId]
                            .coffeeBeans
                      );
                    },
                  }),
                  send("grinded", {
                    delay: (context: any, event: any, { _event }): number => {
                      const delayExpr =
                        context["grindingTimes"][context["coffeeTask"].size];

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
          sendParent((context: any, event: any, { _event }) => ({
            type: "updateResource.water",
            data: {
              payload:
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                context["drinkRecipes"][context["coffeeTask"].drinkId].water,
            },
          })),
          assign({
            currentWater: (context: any, event: any) => {
              return (
                context["currentWater"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                  context["drinkRecipes"][context["coffeeTask"].drinkId].water
              );
            },
          }),
          send("waterHeated", {
            delay: (context: any, event: any, { _event }): number => {
              const delayExpr =
                context["heatingTime"][context["coffeeTask"].size];

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
            delay: (context: any, event: any, { _event }): number => {
              const delayExpr =
                context["brewingTimes"][context["coffeeTask"].drinkId];

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
          sendParent((context: any, event: any, { _event }) => ({
            type: "updateResource.chocolate",
            data: {
              payload:
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                context["drinkRecipes"][context["coffeeTask"].drinkId]
                  .chocolate,
            },
          })),
          assign({
            currentChocolate: (context: any, event: any) => {
              return (
                context["currentChocolate"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                  context["drinkRecipes"][context["coffeeTask"].drinkId]
                    .chocolate
              );
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
          sendParent((context: any, event: any, { _event }) => ({
            type: "updateResource.milk",
            data: {
              payload:
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                context["drinkRecipes"][context["coffeeTask"].drinkId].milk,
            },
          })),
          assign({
            currentMilk: (context: any, event: any) => {
              return (
                context["currentMilk"] -
                context["sizeQuantifiers"][context["coffeeTask"].size] *
                  context["drinkRecipes"][context["coffeeTask"].drinkId].milk
              );
            },
          }),
          send("milkHeated", {
            delay: (context: any, event: any, { _event }): number => {
              const delayExpr =
                context["heatingTime"][context["coffeeTask"].size];

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
            delay: (context: any, event: any, { _event }): number => {
              const delayExpr =
                context["pouringTimes"][context["coffeeTask"].size];

              return delayToMs(delayExpr);
            },
          }),
          assign({
            remainingQuantity: (context: any, event: any) => {
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
  },
  {
    actions: {},
    guards: {
      cond_0: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"] === undefined,
      cond_1: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].drinkId === undefined,
      cond_2: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].size === undefined,
      cond_3: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].quantity === undefined,
      cond_4: (context: any, event: any, { cond, _event }) =>
        context["currentCoffeeBeans"] -
          context["sizeQuantifiers"][context["coffeeTask"].size] *
            context["drinkRecipes"][context["coffeeTask"].drinkId].coffeeBeans <
        0,
      cond_5: (context: any, event: any, { cond, _event }) =>
        context["currentMilk"] -
          context["sizeQuantifiers"][context["coffeeTask"].size] *
            context["drinkRecipes"][context["coffeeTask"].drinkId].milk <
        0,
      cond_6: (context: any, event: any, { cond, _event }) =>
        context["currentWater"] -
          context["sizeQuantifiers"][context["coffeeTask"].size] *
            context["drinkRecipes"][context["coffeeTask"].drinkId].water <
        0,
      cond_7: (context: any, event: any, { cond, _event }) =>
        context["currentChocolate"] -
          context["sizeQuantifiers"][context["coffeeTask"].size] *
            context["drinkRecipes"][context["coffeeTask"].drinkId].chocolate <
        0,
      cond_8: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].drinkId === "hotWater" ||
        context["coffeeTask"].drinkId === "hotChocolate",
      cond_9: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].drinkId !== "hotWater" &&
        context["coffeeTask"].drinkId !== "hotChocolate",
      cond_10: (context: any, event: any, { cond, _event }) =>
        event.data === "coffeeBeans",
      cond_11: (context: any, event: any, { cond, _event }) =>
        event.data === "water",
      cond_12: (context: any, event: any, { cond, _event }) =>
        event.data === "milk",
      cond_13: (context: any, event: any, { cond, _event }) =>
        event.data === "chocolate",
      cond_14: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"] !== undefined,
      cond_15: (context: any, event: any, { cond, _event }) =>
        context["drinkRecipes"][context["coffeeTask"].drinkId].coffeeBeans !==
        0,
      cond_16: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].drinkId === "hotWater",
      cond_17: (context: any, event: any, { cond, _event }) =>
        context["coffeeTask"].drinkId === "hotChocolate",
      cond_18: (context: any, event: any, { cond, _event }) =>
        context["drinkRecipes"][context["coffeeTask"].drinkId].milk !== 0,
      cond_19: (context: any, event: any, { cond, _event }) =>
        context["drinkRecipes"][context["coffeeTask"].drinkId].milk === 0,
      cond_20: (context: any, event: any, { cond, _event }) =>
        context["remainingQuantity"] > 0,
      cond_21: (context: any, event: any, { cond, _event }) =>
        context["remainingQuantity"] === 0,
    },
    delays: {},
    services: {},
  }
);

/*======================================================= Main Machine =======================================================*/
const coffeeMachine = createMachine(
  {
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
                    assign((context: any, event: any) => {
                      const update: Record<string, any> = {};
                      update["allAvailableResources"] = {
                        ...context["allAvailableResources"],
                      };
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
                    assign((context: any, event: any) => {
                      const update: Record<string, any> = {};
                      update["allAvailableResources"] = {
                        ...context["allAvailableResources"],
                      };
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
                    assign((context: any, event: any) => {
                      const update: Record<string, any> = {};
                      update["allAvailableResources"] = {
                        ...context["allAvailableResources"],
                      };
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
                    assign((context: any, event: any) => {
                      const update: Record<string, any> = {};
                      update["allAvailableResources"] = {
                        ...context["allAvailableResources"],
                      };
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
                  currentTask: (context: any, event: any) =>
                    `busy.${context._spawnedServicesCounter}`,
                  _spawnedServices: (context: any, event: any) => {
                    const tmp = { ...context._spawnedServices };
                    tmp[`busy.${context._spawnedServicesCounter}`] = spawn(
                      InvokedMachineFactory(machine_0, {
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
                        currentChocolate:
                          context["allAvailableResources"].chocolate,
                        currentCoffeeBeans:
                          context["allAvailableResources"].coffeeBeans,
                        coffeeTask: event.data.payload,
                      }),
                      `busy.${context._spawnedServicesCounter}`
                    );
                    return tmp;
                  },
                  _spawnedServicesCounter: (context: any, event: any) =>
                    context._spawnedServicesCounter + 1,
                }),
                exit: stop((context: any) => context["currentTask"]),
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
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
                                    update[
                                      "allAvailableResources"
                                    ].coffeeBeans = 100;
                                    return update;
                                  }),
                                ],
                                cond: "cond_7",
                              },
                              {
                                actions: [
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
                                    update[
                                      "allAvailableResources"
                                    ].coffeeBeans =
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
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
                                    update["allAvailableResources"].water = 100;
                                    return update;
                                  }),
                                ],
                                cond: "cond_9",
                              },
                              {
                                actions: [
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
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
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
                                    update["allAvailableResources"].milk = 100;
                                    return update;
                                  }),
                                ],
                                cond: "cond_11",
                              },
                              {
                                actions: [
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
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
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
                                    update[
                                      "allAvailableResources"
                                    ].chocolate = 100;
                                    return update;
                                  }),
                                ],
                                cond: "cond_13",
                              },
                              {
                                actions: [
                                  assign((context: any, event: any) => {
                                    const update: Record<string, any> = {};
                                    update["allAvailableResources"] = {
                                      ...context["allAvailableResources"],
                                    };
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
  },
  {
    actions: {
      wotResponse_0: (context, event) => {
        responseHandlerEmitter.emit("outOfResource", event.data);
      },
      wotResponse_1: (context, event) => {
        responseHandlerEmitter.emit("taskDone");
      },
      wotResponse_2: (context, event) => {
        responseHandlerEmitter.emit("refilled");
      },
    },
    guards: {
      cond_0: (context: any, event: any, { cond, _event }) =>
        event.type.includes("update") && event.type.endsWith("coffeeBeans"),
      cond_1: (context: any, event: any, { cond, _event }) =>
        event.type.includes("update") && event.type.endsWith("water"),
      cond_2: (context: any, event: any, { cond, _event }) =>
        event.type.includes("update") && event.type.endsWith("milk"),
      cond_3: (context: any, event: any, { cond, _event }) =>
        event.type.includes("update") && event.type.endsWith("chocolate"),
      cond_4: (context: any, event: any, { cond, _event }) =>
        event.type.includes("done.invoke"),
      cond_5: (context: any, event: any, { cond, _event }) =>
        event.type.includes("done.invoke"),
      cond_6: (context: any, event: any, { cond, _event }) =>
        event.data.uriVariables.id === "coffeeBeans",
      cond_7: (context: any, event: any, { cond, _event }) =>
        context["allAvailableResources"].coffeeBeans + event.data.payload > 100,
      cond_8: (context: any, event: any, { cond, _event }) =>
        event.data.uriVariables.id === "water",
      cond_9: (context: any, event: any, { cond, _event }) =>
        context["allAvailableResources"].water + event.data.payload > 100,
      cond_10: (context: any, event: any, { cond, _event }) =>
        event.data.uriVariables.id === "milk",
      cond_11: (context: any, event: any, { cond, _event }) =>
        context["allAvailableResources"].milk + event.data.payload > 100,
      cond_12: (context: any, event: any, { cond, _event }) =>
        event.data.uriVariables.id === "chocolate",
      cond_13: (context: any, event: any, { cond, _event }) =>
        context["allAvailableResources"].chocolate + event.data.payload > 100,
    },
    delays: {},
    services: {},
  }
);

const service = interpret(coffeeMachine);

/*=================================================== node-wot ==================================================*/
const td: any = {
  "@context": ["https://www.w3.org/2022/wot/td/v1.1", { "@language": "en" }],
  "@type": "Thing",
  title: "machine",
  description: "",
  properties: {
    allAvailableResources: {
      type: "object",
      description:
        "Current level of all available resources given as an integer percentage for each particular resource.\nThe data is obtained from the machine's sensors but can be set manually via the availableResourceLevel property in case the sensors are broken.",
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
      description:
        "The list of possible drinks in general. Doesn't depend on the available resources.",
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
      description:
        "Make a drink from available list of beverages. Accepts drink id, size and quantity as uriVariables.\n Brews one medium americano if no uriVariables are specified.",
      input: {
        drinkId: {
          type: "string",
          description:
            "Defines what drink to make, drinkId is one of possibleDrinks property values, e.g. latte.",
        },
        size: {
          type: "string",
          description:
            "Defines the size of a drink, s = small, m = medium, l = large.",
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
      description:
        "Action used to refill a specific resource in the coffee machine",
      uriVariables: {
        id: {
          description: "ID of the resource to refill",
          type: "string",
          enum: ["water", "milk", "chocolate", "coffeeBeans"],
        },
      },
      input: {
        description:
          "The amount of the resource used to refill. It is added to the current resource level",
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
      description:
        "Out of resource event. Emitted when the available resource level is not sufficient for a desired drink.",
      data: {
        type: "string",
        enum: ["coffeeBeans", "water", "milk", "chocolate"],
      },
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
    "allAvailableResources",
    async () => service.getSnapshot().context["allAvailableResources"]
  );
  thing.setPropertyReadHandler(
    "status",
    () => service.getSnapshot().value["wrapper"]["coffeeOutlet"]
  );
  thing.setPropertyReadHandler(
    "possibleDrinks",
    async () => service.getSnapshot().context["possibleDrinks"]
  );
  thing.setPropertyReadHandler("availableResourceLevel", (options) => {
    if (options && typeof options === "object" && options.uriVariables) {
      const uriVariables = options.uriVariables;
      if (uriVariables["id"]) {
        const id = uriVariables["id"];
        return service.getSnapshot().context["allAvailableResources"][id];
      }
    }
  });
  thing.setPropertyReadHandler("state", async () =>
    service.getSnapshot().toJSON()
  );

  /*=========================================== Property Write Handlers ===========================================*/

  /*============================================ Invoke Action Handlers ===========================================*/

  thing.setActionHandler("makeDrink", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (!["wrapper.coffeeOutlet.idle"].some(currentState.matches)) {
      throw new Error(
        "invokeaction makeDrink is not accessible in current state"
      );
    } else {
      const responsePromise = once(responseHandlerEmitter, "taskDone");
      service.send({
        type: "taskReceived",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      const [data] = await responsePromise;
      return data;
    }
  });
  thing.setActionHandler("refillResource", async (inputData, options) => {
    const currentState = service.getSnapshot();
    if (!["wrapper.coffeeOutlet.idle"].some(currentState.matches)) {
      throw new Error(
        "invokeaction refillResource is not accessible in current state"
      );
    } else {
      const responsePromise = once(responseHandlerEmitter, "refilled");
      service.send({
        type: "refill",
        data: {
          payload: await inputData.value(),
          uriVariables: options?.uriVariables,
        },
      } as any);
      const [data] = await responsePromise;
      return data;
    }
  });

  /*================================================ Event Emitters ===============================================*/

  responseHandlerEmitter.on("outOfResource", (data) => {
    thing.emitEvent("outOfResource", data);
  });

  // thing.setEventUnsubscribeHandler("outOfResource", async (options)=>{

  // })

  /*================================================= On Transition ===============================================*/

  let lastState, lastContext;
  service.onTransition((state, context) => {
    console.log(`${td.title}:`);
    console.log(`Recieved Event: ${JSON.stringify(state.event)}`);
    console.log(`Current State: ${JSON.stringify(state.value)}`);

    lastState = state;
    lastContext = context;
  });

  //Start State Machine and Server
  service.start();
  thing.expose();
});
