import { Command } from 'commander'

import { SCXML2XStateCodeParser } from './lib/xstate-scxml'
import { SCXML2WoTCodeParser } from './lib/wot-scxml'
import * as fs from 'fs'
import * as Path from 'path'
import * as process from 'process'

const program = new Command()

program
  .name('scxmlToXStateConfig')
  .description('A CLI to automatically generate XState Config from a SCXML file')
  .version('0.1.0')

program.option('--wot', 'parse SCXML with extended WoT features')
program.argument('<filePath>', 'the input SCXML file')

program.parse()

const options = program.opts()
const tmpFilePath = program.args[0]
const isWoTExtended: boolean = options.wot

/* Normalizing paths */
let filePathParts = tmpFilePath.split(Path.win32.sep)
if (filePathParts.length === 1) { filePathParts = filePathParts[0].split(Path.posix.sep) }
let inputFilePath = Path.join(...filePathParts)

/* Change working directory to the directory where the input file resides */
process.chdir(Path.resolve(inputFilePath, '..'))
const currentDir = process.cwd()
const fileName = filePathParts[filePathParts.length - 1]
inputFilePath = Path.join(currentDir, fileName)

const smSCXML = fs.readFileSync(inputFilePath, { encoding: 'utf-8' })

const wrapper = async (): Promise<void> => {
  const parser = isWoTExtended ? new SCXML2WoTCodeParser() : new SCXML2XStateCodeParser()
  const code = await parser.generateXStateCode(smSCXML)

  const outFilePath = inputFilePath.replace('.scxml', '.xstate.ts')

  fs.writeFileSync(outFilePath, code)
}

void wrapper()
