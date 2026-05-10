// ════════════════════════════════════
// STORAGE KEYS
// ════════════════════════════════════
let allEntries = [], allUsers = [], targets = {}, currentUser = null, charts = {}, selectedDeal = '', editingEntryId = null;
let allOrders = [], allShipOrders = [], allOrderOrders = [], orderBasis = 'ship';
let allNotices = [], allRevisits = [], allClients = [], dashFilter = 'all', statsPersonId = 'all', reportMode = 'week', viewingClientId = null;
let fbListeners = [];

// ════════════════════════════════════
// FIREBASE CONFIG
// ════════════════════════════════════
let DB_URL = 'https://membership-7aef2-default-rtdb.firebaseio.com';

function saveFbConfig() {}

function toggleMobMenu(){
  document.querySelector('.sidebar').classList.toggle('mob-open');
  document.getElementById('mob-overlay').classList.toggle('open');
}
function closeMobMenu(){
  document.querySelector('.sidebar').classList.remove('mob-open');
  document.getElementById('mob-overlay').classList.remove('open');
}

// ════════════════════════════════════
