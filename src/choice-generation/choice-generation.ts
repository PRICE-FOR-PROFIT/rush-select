import {
  Choice,
  CreatedChoicesAndScriptNames,
  Package,
  RushProjectWithPackageJson,
  SavedEntry
} from '../shared/types/interfaces'

export const createChoices = (
  projects: RushProjectWithPackageJson[],
  scriptFilterFn: (_: string) => boolean = () => true
): CreatedChoicesAndScriptNames => {
  if (!scriptFilterFn) {
    scriptFilterFn = () => {
      return true
    }
  }

  const filteredProjects = projects.filter(({ packageJson }: RushProjectWithPackageJson) => {
    const hasUnfilteredScripts = Object.keys(packageJson?.scripts || {}).some((scriptName) =>
      scriptFilterFn(scriptName)
    )
    return (
      packageJson &&
      packageJson?.scripts &&
      // some projects may not have a single script that is allowed to run, so filter them out
      hasUnfilteredScripts
    )
  })

  const tempSet = new Set<string>([])
  const choices: Choice[] = filteredProjects.reduce(
    (total, { packageJson, packageName, reviewCategory }) => {
      // keep track of the scripts that were found
      if (packageJson.scripts) {
        Object.keys(packageJson.scripts).forEach((s) => tempSet.add(s))
      }

      const availableScripts = Object.keys(packageJson.scripts || {})
        .sort((a, b) => a.localeCompare(b))
        .filter(scriptFilterFn)

      return [
        ...total,
        {
          name: packageName,
          category: reviewCategory ?? '',
          scriptExecutable: 'npm',
          scriptCommand: ['run'],
          availableScripts
        }
      ]
    },
    [] as Choice[]
  )

  return {
    choices,
    allScriptNames: Array.from(tempSet)
  }
}

export const applySelectedScriptsOnChoicesFromCache = (
  choices: Choice[],
  savedProjectScripts: SavedEntry,
  scriptFilterFn: (param: string) => boolean
): void => {
  // set the initial values, if possible
  savedProjectScripts.packages.forEach((savedProjectScript: Package) => {
    const foundChoice = choices.find(
      (unusedChoice: Choice) => unusedChoice.name === savedProjectScript.packageName
    )

    if (foundChoice) {
      if (!scriptFilterFn || scriptFilterFn(savedProjectScript.script)) {
        if (!Array.isArray(foundChoice.initial)) {
          foundChoice.initial = []
        }
        foundChoice.initial.push(savedProjectScript.script)
      }
    }
  })
}
