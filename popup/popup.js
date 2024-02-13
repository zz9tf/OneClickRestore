function logTabsForWindows(windowInfoArray) {
  document.querySelector(".windows").innerHTML = "";
  const window_tamplate = document.getElementById("window_template");
  const tab_template = document.getElementById("tab_template");
  for (const windowInfo of windowInfoArray) {
    const win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    win_elem.querySelector(".window-title").textContent =
      windowInfo.tabs.length + " tabs";
    for (const tab of windowInfo.tabs) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      if (tab.title.length > 45) {
        element.querySelector(".tab-title").textContent =
          tab.title.substring(0, 45) + "...";
      } else {
        element.querySelector(".tab-title").textContent = tab.title;
      }
      element.querySelector(".tab-icon").src = tab.favIconUrl;
      win_elem.querySelector(".window-tabs").append(element);
    }
    document.querySelector(".windows").append(win_elem);
  }
}

function logTabsFormHistory(historyArray) {
  document.querySelector(".windows").innerHTML = "";
  const window_tamplate = document.getElementById("window_template");
  const tab_template = document.getElementById("tab_template");
  for (const window of historyArray.reverse()) {
    const win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    win_elem.querySelector(".window-title").textContent =
      window.length + " tabs";
    for (const tab of window) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      if (tab.title.length > 45) {
        element.querySelector(".tab-title").textContent =
          tab.title.substring(0, 45) + "...";
      } else {
        element.querySelector(".tab-title").textContent = tab.title;
      }
      element.querySelector(".tab-icon").src = tab.favIconUrl;
      win_elem.querySelector(".window-tabs").append(element);
    }
    document.querySelector(".windows").append(win_elem);
  }
}

async function readFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key] || null);
      }
    });
  });
}

async function writeToStorage(key, data) {
  return new Promise((resolve, reject) => {
    const dataToStore = {};
    dataToStore[key] = data;
    chrome.storage.local.set(dataToStore, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

function onError(error) {
  console.error(`Error: ${error}`);
}

// Initialization
const clear = document.querySelector(".clear-button");
const toggle = document.querySelector(".restore-toggle-button");

let is_restore_mode = await readFromStorage("mode");
if (is_restore_mode == null) {
  writeToStorage("mode", false);
}
if (is_restore_mode) {
  let history = await readFromStorage("history");
  if (history == null) {
    history = [];
  }
  logTabsFormHistory(history);
  toggle.classList.toggle("active");
} else {
  chrome.windows.getAll({ populate: true }).then(logTabsForWindows, onError);
}

// Event handlers
clear.addEventListener("click", clearHandler);
toggle.addEventListener("click", toggleHandler);
chrome.storage.onChanged.addListener(historyUpdateHandler);

function clearHandler() {
  if (is_restore_mode) {
    document.querySelector(".windows").innerHTML = "";
    writeToStorage("history", []);
  }
}

function toggleHandler() {
  toggle.classList.toggle("active");
  is_restore_mode = !is_restore_mode;
  writeToStorage("mode", is_restore_mode)
    .then(async () => {
      if (is_restore_mode) {
        let history = await readFromStorage("history");
        if (history == null) {
          history = [];
        }
        logTabsFormHistory(history);
      } else {
        chrome.windows
          .getAll({ populate: true })
          .then(logTabsForWindows, onError);
      }
    })
    .catch(onError);
}

let historyUpdateLock = false;

async function historyUpdateHandler() {
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    while (historyUpdateLock) {
      await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for 10ms before retrying
    }
    historyUpdateLock = true;
    try {
      if ("history" in changes && is_restore_mode) {
        let history = await readFromStorage("history");
        if (history == null) {
          history = [];
        }
        logTabsFormHistory(history);
      }
      if ("urls" in changes && !is_restore_mode) {
        chrome.windows
          .getAll({ populate: true })
          .then(logTabsForWindows, onError);
      }
    } catch (error) {
      console.error("Error updating URLs:", error);
    } finally {
      historyUpdateLock = false;
    }
  });
}

// chrome.tabs.create() -> create a new tab
