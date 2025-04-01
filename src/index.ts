#!/usr/bin/env node

import { spawnStreaming } from '@lerna/child-process'
import colors from 'ansi-colors'
import child_process from 'child_process'
import readline from 'readline'
import {
  applySelectedScriptsOnChoicesFromCache,
  createChoices
} from './choice-generation/choice-generation'
import RushSelect from './prompt/prompt'
import { load, save } from './save-load/save-load'
import { Choice, RushProjectWithPackageJson, SubmittedChoice } from './shared/types/interfaces'
import { getProjectsAndRespectivePackageJson, getRushRootDir } from './shared/utils/rush'

import path from 'path'
import { getArgs } from './yargs/yargs'
const argv = getArgs()

// scripts that should be executed with this prompt. Can be edited, shouldn't break anything
// the order of the strings will be preserved in the prompt
if (argv.include === undefined) {
  argv.include = null
} else if (!Array.isArray(argv.include)) {
  argv.include = [argv.include]
}

if (argv.exclude === undefined) {
  argv.exclude = null
} else if (!Array.isArray(argv.exclude)) {
  argv.exclude = [argv.exclude]
}

const isScriptNameAllowed = (scriptName: string): boolean =>
  !!(argv.include === null || (argv.include && argv.include.includes(scriptName))) &&
  !!(argv.exclude === null || (argv.exclude && !argv.exclude.includes(scriptName)))

const createRushPrompt = async (
  choices: Array<Choice>,
  allScriptNames: Array<string>,
  projects: RushProjectWithPackageJson[]
) => {
  const rushSelect = new RushSelect({
    name: 'rush-select',
    message:
      'Select what to run. Use left/right arrows to change options, Enter key starts execution.',
    messageWidth: 150,
    margin: [0, 1, 0, 0],
    styles: { primary: colors.grey },
    choices,
    executionGroups: [
      {
        category: 'Pre-scripts (executes from top to bottom)',
        name: 'rush',
        scriptNames: ['ignore', 'install', 'update'],
        scriptExecutable: 'rush',
        customSortText: '_',
        scriptCommand: []
      },
      {
        category: 'Build',
        name: 'rush build',
        initial: 'ignore',
        allowMultipleScripts: false,
        scriptNames: ['ignore', 'regular', 'rebuild', 'smart'],
        scriptExecutable: 'rush',
        customSortText: '__',
        scriptCommand: []
      }
    ],
    edgeLength: 2,
    // the description above the items
    scale: allScriptNames
      .sort((a, b) => a.localeCompare(b))
      .map((name: string) => ({
        name
      }))
  })

  const scriptsToRun: SubmittedChoice[] = await rushSelect.run()

  if (scriptsToRun.length === 0) {
    return null
  }

  interface Scripts {
    pre: SubmittedChoice[]
    rushBuild?: SubmittedChoice
    main: SubmittedChoice[]
  }

  const scripts: Scripts = {
    pre: [],
    rushBuild: undefined,
    main: []
  }

  scriptsToRun
    .filter((item: SubmittedChoice) => item.script !== undefined)
    .forEach((item: SubmittedChoice) => {
      if (item === null) {
        return
      }

      if (item.packageName === 'rush') {
        scripts.pre.push(item)
        return
      }

      if (item.packageName === 'rush build') {
        scripts.rushBuild = item
        return
      }

      // add project reference
      const project = projects.find(
        (p: RushProjectWithPackageJson) => p.packageName === item.packageName
      )
      if (project) {
        scripts.main.push({
          ...item,
          project
        })
      }
    })

  save(getRushRootDir(), scripts.main)

  return scripts
}

const runScripts = (submittedChoices: Array<SubmittedChoice>) => {
  const getPrefix = (packageName: string, script: string) => packageName + ' > ' + script + ' '
  const longestSequence = submittedChoices.reduce((val: number, curr: SubmittedChoice) => {
    const result = getPrefix(curr.packageName, curr.script).length

    return result > val ? result : val
  }, 0)

  return (
    submittedChoices
      // .filter((submittedChoice) => !!submittedChoice.project)
      .map((submittedChoice: SubmittedChoice) =>
        spawnStreaming(
          submittedChoice.scriptExecutable,
          (submittedChoice.scriptCommand || []).concat(submittedChoice.script),
          {
            cwd: submittedChoice
              ? (() =>
                  submittedChoice?.project
                    ? path.resolve(getRushRootDir(), submittedChoice?.project?.projectFolder)
                    : path.resolve(getRushRootDir()))()
              : getRushRootDir(),
            env: { FORCE_COLOR: true }
          },
          getPrefix(submittedChoice.packageName, submittedChoice.script).padEnd(
            longestSequence,
            ' '
          )
        )
      )
  )
}

// makes user able to CTRL + C during execution
const awaitProcesses = async (processes: Array<child_process.ChildProcess>) => {
  let error = false

  for (const process of processes) {
    await new Promise((resolve) => {
      let resolved = false
      process.once('exit', (exitCode: number) => {
        if (exitCode !== 0) {
          error = true
        }
        if (!resolved) {
          resolved = true
          resolve(exitCode)
        }
      })

      process.once('close', (exitCode: number) => {
        if (exitCode !== 0) {
          error = true

          if (exitCode === -2) {
            console.warn(
              'There was an error. Double-check that you have installed rush via "npm install -g @microsoft/rush'
            )
          }
        }
        if (!resolved) {
          resolved = true
          resolve(exitCode)
        }
      })
    })
  }

  return { error }
}

async function main() {
  const projects = getProjectsAndRespectivePackageJson()

  do {
    const { choices, allScriptNames } = createChoices(projects, isScriptNameAllowed)
    const savedProjectScripts = load(getRushRootDir())
    applySelectedScriptsOnChoicesFromCache(choices, savedProjectScripts, isScriptNameAllowed)

    let scripts = null

    try {
      scripts = await createRushPrompt(choices, allScriptNames, projects)
    } catch (e) {
      if (e === '') {
        // user aborted prompt
        return
      }
      throw e
    }

    if (scripts === null) {
      return
    }

    console.log('Starting pre-scripts')

    let nonZeroExit

    // run through the prescripts sequentially
    for (const preScript of scripts.pre) {
      const { error } = await awaitProcesses(runScripts([preScript]))

      nonZeroExit = nonZeroExit || error
    }

    if (!nonZeroExit) {
      let rushBuildProcess

      // get unique package names that are set to run scripts
      const packagesThatWillRunScripts = Array.from(
        scripts.main.reduce((set, item) => {
          set.add(item.packageName)
          return set
        }, new Set())
      )

      if (scripts.rushBuild) {
        if (scripts.rushBuild.script === 'smart' && packagesThatWillRunScripts.length > 0) {
          const executable = 'rush'
          // @ts-expect-error ts-migrate(2339) FIXME: Property 'flat' does not exist on type 'unknown[][... Remove this comment to see the full error message
          const args = ['build'].concat(packagesThatWillRunScripts.map((p) => ['--to', p]).flat())

          console.log('Starting smart rush build step: ' + executable + ' ' + args.join(' '))

          rushBuildProcess = spawnStreaming(
            executable,
            args,
            { cwd: getRushRootDir(), stdio: 'inherit' },
            'smart rush build'
          )
        } else if (scripts.rushBuild.script === 'regular') {
          const executable = 'rush'
          const args = ['build']

          console.log('Starting regular rush build step: ' + executable + ' ' + args.join(' '))

          rushBuildProcess = spawnStreaming(
            executable,
            args,
            { cwd: getRushRootDir() },
            'incremental rush build'
          )
        } else if (scripts.rushBuild.script === 'rebuild') {
          const executable = 'rush'
          const args = ['rebuild']

          console.log(
            'Starting rush rebuild step, building everything. Grab coffee.. ' +
              executable +
              ' ' +
              args.join(' ')
          )

          rushBuildProcess = spawnStreaming(
            executable,
            args,
            { cwd: getRushRootDir() },
            'rush rebuild'
          )
        }

        if (rushBuildProcess) {
          const { error } = await awaitProcesses([rushBuildProcess])

          // weirdly, rush doesn't seem to exit with non-zero when builds fail..
          nonZeroExit = nonZeroExit || error
        }
      }
    }

    if (nonZeroExit) {
      const rl = readline.createInterface(process.stdin, process.stdout)

      const continueDespiteErrors = await new Promise((resolve) => {
        rl.question('There were warnings or errors during build, continue? [Y/n]: ', (answer) =>
          resolve(/([Yy]|^$)/.test(answer))
        )
      })

      if (!continueDespiteErrors) {
        throw new Error('Exiting.')
      }
    }

    console.log('Starting main scripts')
    await awaitProcesses(runScripts(scripts.main))

    // eslint-disable-next-line
  } while (true)
}

module.exports = main()
