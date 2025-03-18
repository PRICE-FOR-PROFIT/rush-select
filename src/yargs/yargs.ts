import yargs from 'yargs'
import { Argv } from '../shared/types/interfaces'

/**
 * Defines command line arguments using yargs.
 *
 * @returns {Argv} The parsed arguments.
 *
 * The function sets up yargs to parse command line arguments with the following options:
 * - `include` (`-i`): A string parameter that can be set one or multiple times to specify scripts that should be available in the prompt.
 * - `exclude` (`-e`): A string parameter that can be set one or multiple times to specify scripts that should be filtered out in the prompt.
 *
 * Example usage:
 * ```
 * rush-select --include start
 * rush-select -i start
 * rush-select --exclude build
 * rush-select -e build -e build:watch
 * ```
 */
export const getArgs = (): Argv =>
  yargs.usage('$0 --include start --include build:watch -d lint').options({
    include: {
      alias: 'i',
      demandOption: false,
      describe:
        'Set this parameter one or multiple times to specify scripts that should be available in the prompt.',
      type: 'string'
    },
    exclude: {
      alias: 'e',
      demandOption: false,
      describe:
        'Set this parameter one or multiple times to specify some scripts that should be filtered out in the prompt.',
      type: 'string'
    }
  }).argv
