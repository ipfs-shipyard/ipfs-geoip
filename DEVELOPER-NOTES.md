# Load fixtures

We need to load a fixture with the following command:

```bash
./bin/load-fixtures.sh bafyreif3tfdpr5n4jdrbielmcapwvbpcthepfkwq2vwonmlhirbjmotedi
```

then, we can do `npm run test:node -- -g 'lookup via HTTP Gateway'` to run a test that will tell us of any subsequent fixtures we need to load, and replace the CID in the above command with the CID that the test hangs on, and repeat.
