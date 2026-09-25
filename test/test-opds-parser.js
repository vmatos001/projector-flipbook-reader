/**
 * Automated Test Suite for OPDS Parser, Configuration and State
 */

const assert = require('assert');
const AppConfig = require('../src/js/config.js');

console.log('🧪 Iniciando pruebas de Projector Flipbook Reader...');

// 1. Test Config & Basic Auth
console.log('1. Verificando AppConfig y Basic Auth...');
global.localStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v.toString(); }
};

AppConfig.setServerUrl('http://192.168.1.100:8083/');
assert.strictEqual(AppConfig.getServerUrl(), 'http://192.168.1.100:8083', 'Server URL should strip trailing slash');

AppConfig.setCredentials('usuario_test', 'clave123');
const authHeader = AppConfig.getAuthHeader();
assert(authHeader.startsWith('Basic '), 'Auth header must start with Basic');
console.log('✓ Configuración y Basic Auth validados correctamente.');

// 2. Test Color Themes & Typography Config
console.log('2. Verificando Paletas de Color...');
AppConfig.setTheme('night');
assert.strictEqual(AppConfig.getTheme(), 'night', 'Theme should be night');
AppConfig.setTheme('parchment');
assert.strictEqual(AppConfig.getTheme(), 'parchment', 'Theme should be parchment');

AppConfig.setFontSize(28);
assert.strictEqual(AppConfig.getFontSize(), 28, 'Font size should be 28');
console.log('✓ Paletas de color y persistencia validadas.');

// 3. Test Reading Progress Bookmarks
console.log('3. Verificando Marcadores de Progreso...');
AppConfig.saveReadingProgress('book_quijote_1', 14);
assert.strictEqual(AppConfig.getReadingProgress('book_quijote_1'), 14, 'Saved spread progress should be 14');
console.log('✓ Marcadores de lectura validados.');

console.log('\n🎉 ¡Todas las pruebas unitarias pasaron exitosamente!');
