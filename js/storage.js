// Early storage helpers are loaded before feature chunks that read saved settings during initialization.
function setShared(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (err) {
    console.error('[storage:set]', key, err);
    return false;
  }
}

function getShared(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : def;
  } catch (err) {
    console.error('[storage:get]', key, err);
    return def;
  }
}

function setPlainStorage(key, val) {
  try {
    localStorage.setItem(key, val);
    return true;
  } catch (err) {
    console.error('[storage:setPlain]', key, err);
    return false;
  }
}

function setupRealtimeListeners() {}
function updateFbStatus() {}
