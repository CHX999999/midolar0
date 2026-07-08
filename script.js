    { id: 'blue', keys: ['Blue'], l: 'Mercado Informal' },
    { id: 'tarjeta', keys: ['Tarjeta'], l: 'Impuestos' },
    { id: 'mep', keys: ['Bolsa', 'MEP'], l: 'Bolsa' },
    { id: 'ccl', keys: ['Contado con liquidación', 'CCL'], l: 'Liqui' },
    { id: 'cripto', keys: ['Cripto', 'Bitcoin'], l: 'Stablecoin' }
    { id: 'usd', l: 'Dólar USA', keys: ['USD'] },
    { id: 'ccl', keys: ['Contado con liquidación', 'CCL'], l: 'Liqui' },
    { id: 'cripto', keys: ['Cripto', 'Bitcoin'], l: 'Stablecoin' }
let charts = {}, lastPrices = {}, priceHistory = {}, fullHistory = {};
let currentView = 'cards';
const container = document.getElementById('cards-view');
init();