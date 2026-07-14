import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

const sourceDirectory = (directory) => fileURLToPath(new URL(`./src/${directory}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: Object.fromEntries(
      ['app', 'components', 'constants', 'features', 'hooks', 'layouts', 'lib', 'styles', 'utils', 'views']
        .map((directory) => [directory, sourceDirectory(directory)]),
    ),
  },
})
