import test from 'node:test';
import assert from 'node:assert/strict';
import '../scripts/offline-test-guard.mjs';
test('public test runner rejects external fetch before networking',()=>{
 assert.throws(()=>fetch('https://fictional.invalid/not-a-network-test'),{code:'OFFLINE_TEST_NETWORK'});
});
