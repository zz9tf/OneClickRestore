// Initialize varables
var mutex = false;
var popup_port = undefined;

// Listen for popup closed
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === "popup") {
    console.log("popup connected");
    popup_port = port;
    port.onDisconnect.addListener(function () {
      console.log("popup disconnected");
      popup_port = undefined;
    });
  }
});

/**
 * Get current `urls` and `windowId2TabId` for current tabs:
 *
 *        urls[tab.id] = {
 *          url: tab.url,
 *          title: tab.title,
 *          favIconUrl: tab.favIconUrl,
 *         };
 *
 *        windowId2TabId = {windowId : [...tab.id]}
 *
 * @returns {Object} { urls, windowId2TabId }
 */
async function getCurrentUrls() {
  console.log("getCurrentUrls");
  return new Promise((resolve, reject) => {
    let urls = {};
    let windowId2TabId = {}; // {windowId : [...tab.id]}
    // Query all windows
    chrome.windows.getAll({ populate: true }, function (windows) {
      // Clear the existing urls dictionary
      urls = {};
      windowId2TabId = {};

      // Iterate through each window
      windows.forEach(function (window) {
        // Dictionary to store tab IDs mapped to their details
        let windowTabs = [];

        // Iterate through each tab in the window
        window.tabs.forEach(function (tab) {
          // Add tab details to the windowTabs dictionary
          urls[tab.id] = {
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            // Add more properties as needed
          };
          windowTabs.push(tab.id);
        });

        // Add the windowTabs dictionary to the urls dictionary
        windowId2TabId[window.id] = windowTabs;
      });
      resolve({ urls, windowId2TabId });
    });
  });
}

/**
 * Reads data from Chrome local storage for the specified key.
 * @param {string} key - The key to retrieve data from local storage.
 * @returns {Promise<any>} A Promise that resolves with the data retrieved from storage, or null if the key does not exist.
 */
async function readFromStorage(key) {
  console.log("readFromStorage");
  const response = await chrome.storage.local.get([key]);
  return response == undefined ? null : response[key];
}

/**
 * Writes data to Chrome local storage for the specified key.
 * @param {string} key - The key to store the data in local storage.
 * @param {any} data - The data to be stored.
 * @returns {Promise<void>} A Promise that resolves when the data has been successfully written to storage.
 */
async function writeToStorage(key, data) {
  console.log("writeToStorage")
  let totalBytes = await chrome.storage.local.getBytesInUse(null);
  const keybytes = await chrome.storage.local.getBytesInUse([key]);
  const dataSize = new Blob([JSON.stringify(data)]).size;
  totalBytes = totalBytes + dataSize - keybytes;
  console.log(key, data);

  let history = data;
  if (key != 'history') {
    history = await chrome.storage.local.get(["history"]);
    history = history['history'];
  }

  const localSizeLimitation = 5242880;
  if (totalBytes > localSizeLimitation) {
    console.log(history);
    let usedBytes = JSON.stringify(history).length;
    const requireBytes = usedBytes - totalBytes + localSizeLimitation;
    while (usedBytes > requireBytes && 0 < history.length) {
      usedBytes -= JSON.stringify(history[0].length);
      history.splice(0, 1);
    }
    await chrome.storage.local.set({ ["history"]: history });
    if (key != 'history') {
      await chrome.storage.local.set({ [key]: data });
      return data;
    } else {
      return history;
    }
  } else {
    await chrome.storage.local.set({ [key]: data });
    return data;
  }
}


/**
 * Executes a callback function while preventing concurrent execution using a mutex.
 * @param {Function} callback - The callback function to execute.
 * @returns {Promise<any>} A Promise that resolves with the result of the callback function.
 */
async function mutexWrapper(callback) {
  console.log("mutexWrapper");
  while (mutex == true) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  mutex = true;
  const response = await callback();
  mutex = false;
  return response;
}

/**
 * Updates data in Chrome local storage and posts a message to a popup window.
 *
 *        history = [
 *           {
 *              date: when the urls are closed,
 *              urls: dataAddToHistory,
 *              pin: boolean
 *           }...
 *        ];
 * 
 *
 *        dataAddToHistory = [{url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl} ...]
 *
 *        urls[tab.id] = {
 *          url: tab.url,
 *          title: tab.title,
 *          favIconUrl: tab.favIconUrl,
 *         };
 *
 *        windowId2TabId = {windowId : [...tab.id]}
 *
 * @param {any} dataAddToHistory - Data to add to the history stored in local storage
 * @param {Object} urls - Object containing URL information.
 * @param {Object} windowId2TabId - Object containing window-to-tab mappings. {windowId : [...tab.id]}
 * @returns {Promise<void>} A Promise that resolves when the data has been successfully updated and the message has been posted.
 */
async function updateData(dataAddToHistory, urls, windowId2TabId) {
  console.log("updateData");
  // store the closed url into the history
  let history = await readFromStorage("history");
  if (history == null) {
    history = [];
  }
  history.push({ date: new Date().toString(), urls: dataAddToHistory, pin: false });
  history = await writeToStorage("history", history);

  // Update my recording
  await writeToStorage("urls", urls);
  await writeToStorage("windowId2TabId", windowId2TabId);

  // post message to popup window
  let is_restore_mode = await readFromStorage("mode");
  if (popup_port != undefined) {
    if (is_restore_mode) {
      console.log("updateHistory popup");
      popup_port.postMessage({ operation: "updateHistory", data: history });
    } else {
      console.log("updateUrls popup");
      popup_port.postMessage({ operation: "updateUrls" });
    }
  }
}

chrome.runtime.onInstalled.addListener(initAndCreatedAndUpdateEventHandler);

// Listen for when a window is created or removed
chrome.windows.onCreated.addListener(initAndCreatedAndUpdateEventHandler);
chrome.windows.onRemoved.addListener(storeClosedWindow);

// Listen for when a tab is created, updated, or removed
chrome.tabs.onCreated.addListener(initAndCreatedAndUpdateEventHandler);
chrome.tabs.onUpdated.addListener(initAndCreatedAndUpdateEventHandler);
chrome.tabs.onRemoved.addListener(storeClosedTabURL);

// Listen for popup operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handlePopupOperation(message).then(sendResponse);
  return true;
});

async function initAndCreatedAndUpdateEventHandler() {
  console.log("initAndCreatedAndUpdateEventHandler");
  let { urls, windowId2TabId } = await getCurrentUrls();
  await mutexWrapper(async () => {
    await writeToStorage("urls", urls);
    await writeToStorage("windowId2TabId", windowId2TabId);
    if (popup_port != undefined) {
      popup_port.postMessage({ operation: "updateUrls" });
    }
  });
}

// Check if the length of current urls has 1 more tab than stored urls.
function checkStoreClosedTabURLIsValid(tabId, storedUrls, urls) {
  console.log("checkStoreClosedTabURLIsValid");
  if (Object.keys(storedUrls).length != Object.keys(urls).length + 1) {
    // Get an array of current urls' titles
    const currentTitles = Object.entries(urls)
      .map(([key, value]) => key + " " + value.title)
      .join("\n");

    // Get an array of stored urls' titles
    const storedTitles = Object.entries(storedUrls)
      .map(([key, value]) => key + " " + value.title)
      .join("\n");
    throw new Error(
      "Invalid history update since the number of current urls is not correct.\n" +
      "current urls: " +
      Object.keys(urls).length +
      "\n" +
      currentTitles +
      "\n\n" +
      "Try to close the tab: " +
      tabId +
      "\n\n" +
      " stored urls:" +
      Object.keys(storedUrls).length +
      "\n" +
      storedTitles
    );
  }
}

async function storeClosedTabURL(tabId, removeInfo) {
  try {
    await chrome.windows.get(removeInfo.windowId);
    console.log("storeClosedTabURL");
    const { urls, windowId2TabId } = await getCurrentUrls();
    await mutexWrapper(async () => {
      const storedUrls = await readFromStorage("urls");
      checkStoreClosedTabURLIsValid(tabId, storedUrls, urls);
      await updateData([storedUrls[tabId]], urls, windowId2TabId);
    });
  } catch (error) {
    return;
  }
}

async function checkStoreClosedWindowIsValid(urls, storedUrls) {
  console.log("checkStoreClosedWindowIsValid");
  if (Object.keys(storedUrls).length != Object.keys(urls).length + 1) {
    // Get an array of current urls' titles
    const currentTitles = Object.entries(urls)
      .map(([key, value]) => value.title)
      .join("\n");

    // Get an array of stored urls' titles
    const storedTitles = Object.entries(storedUrls)
      .map(([key, value]) => value.title)
      .join("\n");
    throw new Error(
      "Invalid history update since the number of current urls is not correct.\n" +
      "current urls: " +
      Object.keys(urls).length +
      "\n" +
      currentTitles +
      "\n\n" +
      "Try to close the tab: " +
      storedUrls[tabId].title +
      "\n\n" +
      " stored urls:" +
      Object.keys(storedUrls).length +
      "\n" +
      storedTitles
    );
  }
}

async function storeClosedWindow(windowId) {
  console.log("storeClosedWindow");
  const { urls, windowId2TabId } = await getCurrentUrls();
  const storedUrls = await readFromStorage("urls");
  const storedWindowId2TabId = await readFromStorage("windowId2TabId");
  if (Object.keys(urls).length == Object.keys(storedUrls).length) {
    console.log("not changed urls");
    return;
  }
  await mutexWrapper(async () => {
    let windowTabs = [];
    for (const i in storedWindowId2TabId[windowId]) {
      windowTabs.push(storedUrls[storedWindowId2TabId[windowId][i]]);
    }
    await updateData(windowTabs, urls, windowId2TabId);
  });
}

async function handlePopupOperation(message) {
  console.log("handlePopupOperation", message);
  if (message[0] === "readFromStorage") {
    const response = await mutexWrapper(async () => {
      const response = await readFromStorage(message[1]);
      return response;
    });
    return response;
  } else if (message[0] === "writeToStorage") {
    await mutexWrapper(async () => {
      message[2] = await writeToStorage(message[1], message[2]);
      if (popup_port != undefined && message[1] == "history") {
        popup_port.postMessage({
          operation: "updateHistory",
          data: message[2],
        });
      }
    });
    return true;
  }
  return false;
}
