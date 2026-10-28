// รันด้วย: npm test
const test = require('node:test');
const assert = require('node:assert');
const { calcPercent, isPass } = require('../services/kpiEngine');
const { isIdent, toNumberOrNull } = require('../services/util');

test('calcPercent', () => {
    assert.strictEqual(calcPercent(200, 90, 100), 45);
    assert.strictEqual(calcPercent(0, 5, 100), 0);
    assert.strictEqual(calcPercent(3, 1, 100), 33.33);
    assert.strictEqual(calcPercent(1000, 3, 1000), 3);
});

test('isPass operators', () => {
    assert.strictEqual(isPass(50, '>=', 50), true);
    assert.strictEqual(isPass(50, '>', 50), false);
    assert.strictEqual(isPass(5, '<=', 7), true);
    assert.strictEqual(isPass(8, '<', 7), false);
    assert.strictEqual(isPass(8, '>=', null), null);
});

test('identifier validation', () => {
    assert.ok(isIdent('s_dm_control'));
    assert.ok(isIdent('1519_1B130'));
    assert.ok(!isIdent('x;drop table'));
    assert.ok(!isIdent(''));
});

test('toNumberOrNull', () => {
    assert.strictEqual(toNumberOrNull(''), null);
    assert.strictEqual(toNumberOrNull('1,500'), 1500);
    assert.ok(Number.isNaN(toNumberOrNull('abc')));
});
