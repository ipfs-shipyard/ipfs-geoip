export default {
  tsRepo: false,
  dependencyCheck: {
    input: [
      'dist/**/*.js',
    ],
    productionInput: [
      'dist/**/*.js',
    ],
  },
  build: {
    config: {
      format: 'esm',
      banner: {
        js: ''
      },
      footer: {
        js: ''
      }
    }
  },
  test: {
    before: (...args) => {
      if (args[0].runner === 'node') {
        return {
          env: {
            NODE_OPTIONS: '--loader=esmock'
          }
        }
      }
    }
  }
}
