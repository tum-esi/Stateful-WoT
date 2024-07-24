import os
import re
import json
from pathlib import Path
from OMPython import OMCSessionZMQ

# Instantiate omc
omc = OMCSessionZMQ()
omc.sendExpression("installPackage(Modelica)")
omc.sendExpression("loadModel(Modelica)")
print(f'{omc.sendExpression("getErrorString()")}')
# Get all models
patternModel = re.compile(r".+\.mo")
modelsList = os.listdir("models")
if(not os.path.isdir("fmus")): os.mkdir("fmus")
modelsList = [file for file in modelsList if patternModel.match(file)]
omc.sendExpression(f'cd("{os.getcwd()}")')
print(f'Current OMC working directory: {omc.sendExpression("cd()")}')

for file in modelsList:
    # Generate Models Path
    modelsPath = Path("models")
    # Open file 
    fileHandler =  open(modelsPath / file, "r")
    modelString = fileHandler.readline()

    # Find model name
    patternModelName = re.compile(r"\s*model\s+(\w+)", re.MULTILINE)
    modelNameMatch = patternModelName.match(modelString)
    modelName = modelNameMatch.group(1)

    modelCMD = 'cd("models")'
    print(f'Changed directory to "models": {omc.sendExpression(modelCMD)}')
    print(f"Loading model file {file}")
    loadSuccessful = omc.sendExpression(f'loadFile("{file}")')

    if loadSuccessful:
        upOneCMD = 'cd("..")'
        print(f'Going back to top directory: {omc.sendExpression(upOneCMD)}')
        fmusCMD = 'cd("fmus")'
        print(f'Current going to "fmus" directory: {omc.sendExpression(fmusCMD)}')
        print(f"Building FMU for model {modelName}")
        answer = omc.sendExpression(f'buildModelFMU({modelName}, fmuType="me_cs")')
        print(f'{omc.sendExpression("getErrorString()")}')
        print(f"{modelName}.fmu generated")
        print(f'Going back to top directory: {omc.sendExpression(upOneCMD)}')
    else:
        print(f"Loading file {file} was not successful")

   