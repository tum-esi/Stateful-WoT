import os
import re
import json
import asyncio
import pyfmi
from pathlib import Path
import functools
import concurrent
import websockets

PORT = 8765
simModels = { }

async def main():
    fmusList = os.listdir("fmus")
    patternFMU = re.compile(r"(\S+).fmu")

    fmusList = [file for file in fmusList if patternFMU.match(file)]
    for file in fmusList:
        fmu_path =  Path('fmus', file)
        fmu_name =  patternFMU.match(file).group(1)
        simModels[fmu_name] = pyfmi.load_fmu(fmu_path)

    print(f"FMUs: {json.dumps(list(simModels.keys()))}")
    async with websockets.serve(simulator, "", PORT):
        print(f"WebSocket Server online ws://localhost:{PORT}/")
        await asyncio.Future()  # run forever

# Instantiate WebSockets
async def simulator(websocket):
    simStatus = { }
    async for message in websocket:
        loop = asyncio.get_running_loop()
        messageObj = json.loads(message)
        simId = messageObj["simId"]
        messageType = messageObj["messageType"]

        if (messageType == "start") or (messageType == "reset"):
            simStatus[simId] = {
                'x': None,
                'x_nominal': None,
                'event_ind': None,
                'time': None,
                'Tnext': None,
                'dt': None,
                'stepSize': None
            }

        with concurrent.futures.ThreadPoolExecutor() as pool:
            result = await loop.run_in_executor(pool, functools.partial(simulationHandler, message, simModels[simId], simStatus[simId]))
            simStatus[simId] = result[1]
            response =  {
                'simId': simId,
                'outputs': result[0]
            }
            await websocket.send(json.dumps(response))
           
def setScalarVariable(fmu, scalarName, value):
    scalarVariable = fmu.get_scalar_variable(scalarName)
    valueRef = [scalarVariable.value_reference]
    scalarType = scalarVariable.type
    match scalarType:
        # Real
        case 0:
            fmu.set_real(valueRef, [value])
        # Integer
        case 1:
            fmu.set_integer(valueRef, [value])
        # Boolean
        case 2:
            fmu.set_boolean(valueRef, [value])
        # String
        case 3:
            fmu.set_string(valueRef, [value])
        # Enum
        case 4:
            NotImplemented
        case _:
            NotImplemented
            
def getScalarVariableValue(fmu, scalarName):
    scalarVariable = fmu.get_scalar_variable(scalarName)
    valueRef = [scalarVariable.value_reference]
    scalarType = scalarVariable.type
    match scalarType:
        # Real
        case 0:
           return fmu.get_real(valueRef).tolist()[0]
        # Integer
        case 1:
           return fmu.get_integer(valueRef).tolist()[0]
        # Boolean
        case 2:
           return fmu.get_boolean(valueRef).tolist()[0]
        # String
        case 3:
           return fmu.get_string(valueRef).tolist()[0]
        # Enum
        case 4:
            return None
        case _:
            return None

def simulationHandler(message, simFMU, simStatus):
    # Values
    x = simStatus['x']
    x_nominal = simStatus['x_nominal']

    # Event indicator
    event_ind = simStatus['event_ind']

    #Current time
    time = simStatus['time']

    #Next time step
    Tnext = simStatus['Tnext']

    #time change
    dt = simStatus['dt']

    #Step size
    stepSize = simStatus['stepSize']

    # {
    #  "simId": id as string,
    #  "messageType": "start" | "step" | "reset" | "terminate",
    #  "parameters": optional object {"id":string, "value": any }(only in "start" and "reset")
    #  "inputs": optional object (not in "terminate")
    #  "stepSize": size as positve number (unit seconds) (only in "start" and "reset")
    # }

    # Extract Data
    messageObj = json.loads(message)
    simId = messageObj["simId"]
    messageType = messageObj["messageType"]
    # simFMU =  simModels[simId]
    variablesDict = simFMU.get_model_variables(include_alias=False)

    if messageType == "reset":
        simFMU.reset()

    # Initialize the model. Also sets all the start attributes defined in the 
    # XML file.
    if (messageType == "start") or (messageType == "reset"):
        stepSize = messageObj["stepSize"]

        simFMU.setup_experiment(start_time = 0)
        simFMU.enter_initialization_mode()

        if messageObj.get("parameters") is not None:
            for param, value in messageObj["parameters"].items():
                setScalarVariable(fmu=simFMU, scalarName=param, value=value)
            simFMU.exit_initialization_mode()

        eInfo = simFMU.get_event_info()
        eInfo.newDiscreteStatesNeeded = True
        #Event iteration
        while eInfo.newDiscreteStatesNeeded == True:
            simFMU.enter_event_mode()
            simFMU.event_update()
            eInfo = simFMU.get_event_info()
        
        simFMU.enter_continuous_time_mode()
        #Get Continuous States
        x = simFMU.continuous_states
        #Get the Nominal Values
        x_nominal = simFMU.nominal_continuous_states
        #Get the Event Indicators
        event_ind = simFMU.get_event_indicators()

        time = 0
        Tnext = stepSize #Used for time events
        dt = stepSize #Step-size
        outputs = simFMU.get_output_list()
        outputsDict = { }
        for output in outputs.keys():
            outputsDict[output] = getScalarVariableValue(simFMU, output)

        newSimStatus = { }
        newSimStatus['x'] = x
        newSimStatus['x_nominal'] = x_nominal
        newSimStatus['event_ind'] = event_ind
        newSimStatus['time'] = time
        newSimStatus['dt'] = dt
        newSimStatus['Tnext'] = Tnext 
        newSimStatus['stepSize'] = stepSize
        return [outputsDict, newSimStatus]

    if messageType == "step":
        
        #Compute the derivative
        dx =  simFMU.get_derivatives()

        #Advance
        h = min(dt, Tnext-time)
        time = time + h

        #Set the time
        simFMU.time = time

        #Set the inputs at the current time (if any)
        if messageObj.get("inputs") is not None:
            for inputName, value in messageObj["inputs"].items():
                setScalarVariable(fmu=simFMU, scalarName=inputName, value=value)

        #Set the states at t = time (Perform the step)
        x = x + h*dx
        simFMU.continuous_states = x

        #Get the event indicators at t = time
        event_ind_new = simFMU.get_event_indicators()
    
        #Inform the model about an accepted step and check for step events
        step_event = simFMU.completed_integrator_step()

        #Check for time and state events
        time_event  = abs(time-Tnext) <= 1.e-10
        state_event = True if True in ((event_ind_new>0.0) != (event_ind>0.0)) else False

        #Event handling
        if step_event or time_event or state_event:
            simFMU.enter_event_mode()
            eInfo = simFMU.get_event_info()
            eInfo.newDiscreteStatesNeeded = True
            #Event iteration
            while eInfo.newDiscreteStatesNeeded:
                simFMU.event_update(intermediateResult=True) #Stops after each event iteration
                eInfo = simFMU.get_event_info()

                #Retrieve solutions (if needed)
                if eInfo.newDiscreteStatesNeeded:
                    #simFMU.get_real, get_integer, get_boolean, 
                    # get_string(valueref)
                    pass
            
            #Check if the event affected the state values and if so sets them
            if eInfo.valuesOfContinuousStatesChanged:
                x = simFMU.continuous_states
                
            #Check for new time event
            if eInfo.nextEventTimeDefined:
                Tnext = eInfo.nextEventTime
            else:
                Tnext = time + stepSize
            simFMU.enter_continuous_time_mode()
        
        event_ind = event_ind_new

        #Get outputs
        outputs = simFMU.get_output_list()
        outputsDict = { }
        for output in outputs.keys():
            outputsDict[output] = getScalarVariableValue(simFMU, output)
        
        newSimStatus = { }
        newSimStatus['x'] = x
        newSimStatus['x_nominal'] = x_nominal
        newSimStatus['event_ind'] = event_ind
        newSimStatus['time'] = time
        newSimStatus['dt'] = dt
        newSimStatus['Tnext'] = Tnext 
        newSimStatus['stepSize'] = stepSize
        return [outputsDict, newSimStatus]

if __name__ == "__main__":
    print("Starting Websockets")
    asyncio.run(main())