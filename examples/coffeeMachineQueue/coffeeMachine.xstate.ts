import {
  createMachine,
  interpret,
  actions,
  spawn,
  AnyStateMachine,
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
    initial: "filling",
    context: {
      fillingTimes: { cappucino: "30s", espresso: "10s" },
      brewingTimes: { cappucino: "120s", espresso: "180s" },
      coffeeToBrew: undefined,
    },
    states: {
      filling: {
        id: "filling",
        initial: undefined,
        entry: [
          {
            type: "xstate.choose",
            conds: [
              {
                actions: [
                  send("filled", {
                    delay: (context: any, event: any, { _event }): number => {
                      const delayExpr =
                        context["fillingTimes"][context["coffeeToBrew"]];

                      return delayToMs(delayExpr);
                    },
                  }),
                ],
                cond: "cond_0",
              },
            ],
          },
        ],
        on: { filled: { target: "#brewing" } },
      },
      brewing: {
        id: "brewing",
        initial: undefined,
        entry: [
          send("brewed", {
            delay: (context: any, event: any, { _event }): number => {
              const delayExpr =
                context["brewingTimes"][context["coffeeToBrew"]];

              return delayToMs(delayExpr);
            },
          }),
        ],
        on: { brewed: { target: "#pouring" } },
      },
      pouring: {
        id: "pouring",
        initial: undefined,
        entry: [send("poured", { delay: 10000 })],
        on: { poured: { target: "#finished" } },
      },
      finished: { id: "finished", type: "final" },
    },
  },
  {
    actions: {},
    guards: {
      cond_0: (context: any, event: any, { cond, _event }) =>
        context["coffeeToBrew"] !== undefined,
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
      queue: [],
      queueLevel: 0,
      queueSize: 5,
      internalTaskRef: null,
      outlet1_task: undefined,
    },
    states: {
      wrapper: {
        id: "wrapper",
        type: "parallel",
        states: {
          taskQueue: {
            id: "taskQueue",
            initial: "empty",
            states: {
              empty: {
                id: "empty",
                initial: undefined,
                on: {
                  enqueue: {
                    target: "#halfFull",
                    actions: [
                      assign({
                        queue: (context: any, event: any) => {
                          return [event.data.task, ...context["queue"]];
                        },
                      }),
                      assign({
                        queueLevel: (context: any, event: any) => {
                          return context["queueLevel"] + 1;
                        },
                      }),
                    ],
                  },
                },
              },
              halfFull: {
                id: "halfFull",
                initial: undefined,
                on: {
                  enqueue: [
                    {
                      target: "#halfFull",
                      cond: "cond_0",
                      actions: [
                        assign({
                          queue: (context: any, event: any) => {
                            return [event.data.task, ...context["queue"]];
                          },
                        }),
                        assign({
                          queueLevel: (context: any, event: any) => {
                            return context["queueLevel"] + 1;
                          },
                        }),
                      ],
                    },
                    {
                      target: "#full",
                      cond: "cond_1",
                      actions: [
                        assign({
                          queue: (context: any, event: any) => {
                            return [event.data.task, ...context["queue"]];
                          },
                        }),
                        assign({
                          queueLevel: (context: any, event: any) => {
                            return context["queueLevel"] + 1;
                          },
                        }),
                      ],
                    },
                  ],
                  dequeue: [
                    {
                      target: "#halfFull",
                      cond: "cond_2",
                      actions: [
                        assign({
                          internalTaskRef: (context: any, event: any) => {
                            return context["queue"][
                              context["queue"].length - 1
                            ];
                          },
                        }),
                        assign({
                          queue: (context: any, event: any) => {
                            return [...context["queue"].slice(0, -1)];
                          },
                        }),
                        assign({
                          queueLevel: (context: any, event: any) => {
                            return context["queueLevel"] - 1;
                          },
                        }),
                        send((context: any, event: any, { _event }) => ({
                          type: "taskDequed",
                          data: {
                            id: event.data.id,
                            task: context["internalTaskRef"],
                          },
                        })),
                      ],
                    },
                    {
                      target: "#empty",
                      cond: "cond_3",
                      actions: [
                        assign({
                          internalTaskRef: (context: any, event: any) => {
                            return context["queue"][
                              context["queue"].length - 1
                            ];
                          },
                        }),
                        assign({
                          queue: (context: any, event: any) => {
                            return [...context["queue"].slice(0, -1)];
                          },
                        }),
                        assign({
                          queueLevel: (context: any, event: any) => {
                            return context["queueLevel"] - 1;
                          },
                        }),
                        send((context: any, event: any, { _event }) => ({
                          type: "taskDequed",
                          data: {
                            id: event.data.id,
                            task: context["internalTaskRef"],
                          },
                        })),
                      ],
                    },
                  ],
                },
              },
              full: {
                id: "full",
                initial: undefined,
                on: {
                  dequeue: {
                    target: "#halfFull",
                    actions: [
                      assign({
                        internalTaskRef: (context: any, event: any) => {
                          return context["queue"][context["queue"].length - 1];
                        },
                      }),
                      assign({
                        queue: (context: any, event: any) => {
                          return [...context["queue"].slice(0, -1)];
                        },
                      }),
                      assign({
                        queueLevel: (context: any, event: any) => {
                          return context["queueLevel"] - 1;
                        },
                      }),
                      send((context: any, event: any, { _event }) => ({
                        type: "taskDequed",
                        data: {
                          id: event.data.id,
                          task: context["internalTaskRef"],
                        },
                      })),
                    ],
                  },
                },
              },
            },
          },
          coffeeOutlet1: {
            id: "coffeeOutlet1",
            initial: "coffeeOutlet1_idle",
            states: {
              coffeeOutlet1_idle: {
                id: "coffeeOutlet1_idle",
                initial: undefined,
                entry: [
                  {
                    type: "xstate.choose",
                    conds: [
                      {
                        actions: [
                          send((context: any, event: any, { _event }) => ({
                            type: "dequeue",
                            data: {
                              id: "coffeeOutlet1",
                            },
                          })),
                        ],
                        cond: "cond_4",
                      },
                    ],
                  },
                ],
                on: {
                  enqueue: { target: "#coffeeOutlet1_idle" },
                  taskDequed: {
                    target: "#coffeeOutlet1_brewing",
                    cond: "cond_5",
                  },
                },
              },
              coffeeOutlet1_brewing: {
                id: "coffeeOutlet1_brewing",
                initial: undefined,
                invoke: {
                  id: "task1",
                  data: {
                    fillingTimes: { cappucino: "30s", espresso: "10s" },
                    brewingTimes: { cappucino: "120s", espresso: "180s" },
                    coffeeToBrew: (context, event) => {
                      return event.data.task;
                    },
                  },
                  src: "machine_0",
                },
                on: { "*": { target: "#coffeeOutlet1_idle", cond: "cond_6" } },
              },
            },
          },
        },
      },
    },
  },
  {
    actions: {},
    guards: {
      cond_0: (context: any, event: any, { cond, _event }) =>
        context["queueLevel"] < context["queueSize"] - 1,
      cond_1: (context: any, event: any, { cond, _event }) =>
        context["queueLevel"] >= context["queueSize"] - 1,
      cond_2: (context: any, event: any, { cond, _event }) =>
        context["queueLevel"] > 1,
      cond_3: (context: any, event: any, { cond, _event }) =>
        context["queueLevel"] <= 1,
      cond_4: (context: any, event: any, { cond, _event }) =>
        context["queueLevel"] >= 1,
      cond_5: (context: any, event: any, { cond, _event }) =>
        event.data.id === "coffeeOutlet1",
      cond_6: (context: any, event: any, { cond, _event }) =>
        event.type.includes("done.invoke"),
    },
    delays: {},
    services: { machine_0: machine_0 },
  }
);
