const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Connection } = require('@solana/web3.js');
const ts = require('typescript');

// Render the real component while keeping persistence and toast notifications local.
function renderInput(rpcUrl) {
  const saved = [];
  let button;
  let updates = 0;
  const filename = path.resolve(__dirname, '../src/components/SetRpcUrlnput.tsx');
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const componentModule = { exports: {} };
  const componentRequire = (id) => {
    if (id === '~/hooks/useSettings') {
      return {
        useRpcUrl: () => ({
          rpcUrl,
          setRpcUrl: { mutateAsync: async (value) => saved.push(value) },
        }),
      };
    }
    if (id === './ui/input') return { Input: 'input' };
    if (id === './ui/button') {
      return {
        Button: (props) => {
          button = props;
          return React.createElement('button', props);
        },
      };
    }
    if (id === 'sonner') return { toast: { promise: (promise) => promise } };
    return require(id);
  };
  const load = vm.runInThisContext(`(function(require, module, exports) {${outputText}\n})`, {
    filename,
  });
  load(componentRequire, componentModule, componentModule.exports);
  const html = renderToStaticMarkup(
    React.createElement(componentModule.exports.default, { onUpdate: () => updates++ })
  );
  return { html, button, saved, getUpdates: () => updates };
}

const validEndpoints = [
  'https://api.mainnet-beta.solana.com',
  'http://127.0.0.1:8899',
  'http://localhost:8899',
  'http://[::1]:8899',
  'https://rpc.example.com/path?api-key=a:b&cluster=devnet',
  'https://rpc.example.com/path#fragment',
];

for (const endpoint of validEndpoints) {
  test(`allows and saves an SDK-compatible RPC endpoint: ${endpoint}`, async () => {
    // Constructing a Connection does not send any RPC requests.
    assert.doesNotThrow(() => new Connection(endpoint));
    assert.doesNotThrow(() => new Request(endpoint));
    const input = renderInput(endpoint);
    assert.equal(input.button.disabled, false);
    assert.doesNotMatch(input.html, /Please enter a valid URL/);
    await input.button.onClick();
    assert.deepEqual(input.saved, [endpoint]);
    assert.equal(input.getUpdates(), 1);
  });
}

const invalidEndpoints = [
  'api.mainnet-beta.solana.com',
  'localhost:8899',
  'ws://localhost:8900',
  'ftp://rpc.example.com',
  'HTTP://localhost:8899',
  'http://[::1',
  'https://user:password@rpc.example.com:443/path',
];

for (const endpoint of invalidEndpoints) {
  test(`rejects an unusable RPC endpoint: ${endpoint}`, async () => {
    assert.throws(() => {
      new Connection(endpoint);
      new Request(endpoint);
    });
    const input = renderInput(endpoint);
    assert.equal(input.button.disabled, true);
    assert.match(input.html, /Please enter a valid URL/);
    await assert.rejects(input.button.onClick(), (error) => error === 'Please enter a valid URL.');
    assert.deepEqual(input.saved, []);
    assert.equal(input.getUpdates(), 0);
  });
}
