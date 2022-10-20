export default {
  tsRepo: false,
  build: {
    config: {
      external: ['fs'],
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
