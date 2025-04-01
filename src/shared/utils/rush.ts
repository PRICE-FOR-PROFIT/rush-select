import findUp from 'find-up'
import fs from 'fs'
import hjson from 'hjson'
import path from 'path'
import { RushProject, RushProjectWithPackageJson } from '../types/interfaces'

let _rushJsonRelativePath: string | null = null

/**
 * Finds the root directory containing the `rush.json` file.
 * Caches the result to avoid repeated lookups.
 *
 * @returns The absolute path to the `rush.json` file.
 * @throws If no `rush.json` file is found in the current directory or any parent directory.
 */
const findRushRootPath = (): string => {
  if (_rushJsonRelativePath !== null) {
    return _rushJsonRelativePath
  }

  _rushJsonRelativePath = findUp.sync('rush.json')

  if (_rushJsonRelativePath === null) {
    throw new Error(
      'Could not find a rush.json file inside or anywhere above the current working directory'
    )
  }

  return _rushJsonRelativePath
}

/**
 * Retrieves the list of projects defined in the `rush.json` file.
 *
 * @returns An array of `RushProject` objects representing the projects in the Rush configuration.
 */
const getProjects = (): RushProject[] => {
  const rushJsonPath = path.resolve(findRushRootPath())

  const rushConfig = hjson.parse(fs.readFileSync(rushJsonPath).toString())
  return rushConfig.projects
}

/**
 * Retrieves the list of projects defined in the `rush.json` file, along with their respective `package.json` contents.
 * The projects are sorted by their `reviewCategory` and `packageName`.
 *
 * @returns An array of `RushProjectWithPackageJson` objects, each containing project details and its `package.json` content.
 */
export const getProjectsAndRespectivePackageJson = (): RushProjectWithPackageJson[] => {
  const projects: RushProject[] = getProjects()

  return projects
    .map((project: RushProject) => {
      return {
        ...project,
        packageJson: require(path.resolve(
          path.dirname(findRushRootPath()),
          project.projectFolder,
          'package.json'
        ))
      } as RushProjectWithPackageJson
    })
    .sort((a: RushProjectWithPackageJson, b: RushProjectWithPackageJson) => {
      if (!b.reviewCategory) return -1
      if (!a.reviewCategory) return 1

      if (a.reviewCategory === b.reviewCategory) {
        return a.packageName.localeCompare(b.packageName)
      }

      return a.reviewCategory.localeCompare(b.reviewCategory)
    })
}

/**
 * Retrieves the root directory of the Rush repository.
 *
 * @returns The absolute path to the root directory containing the `rush.json` file.
 */
export const getRushRootDir = (): string => path.dirname(findRushRootPath())
