# WoT State Machine

The WoT State Machine project is an effort to describe Web of Things API and its behavior using a standardized State Machine description format and use the resulting model to automatically generate a functioning Digital Twin of the device.

State Machines are described using W3C SCXML Standard, which is first parsed and converted to a notation that fits with XState, an open source Typescript State Machine library.
Code for interpreting and executing the State Machine is then generated and can be executed.

We also provide an extension to SCXML that allows to generate fully W3C WoT compliant Digital Twins that expose a server to the outside using the node-wot library. SCXML needs to contain additional keywords for it to function correctly.

## Installation

```bash
yarn install
yarn build
```

## Usage

```bash
yarn cli <scxmlInput>           -> SCXML to XState Code   
yarn cli --wot <scxmlInput>     -> SCXML to node-wot code
```

If a state chart includes Modelica models, copy over the files from [simulator](simulator) folder and run the `buildAndRun.ps1` script. This is a PowerShell script, but a similar script can be easily written for bash.

## Evaluation

Different examples for evaluation can be found under [examples](examples). The Altivar evaluation can be found [here](examples/altivar/) and the PanTilt evaluation can be found [here](examples/pantilt-model).
