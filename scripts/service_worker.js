// Function to update the urls dictionary
async function getCurrentUrls() {
  return new Promise((resolve, reject) => {
    let urls = {}; // {tab.id : tabinfo}
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

let storageLock = false;
chrome.runtime.onInstalled.addListener(initializationStorage);

// Listen for when a window is created or removed
chrome.windows.onCreated.addListener(windowsOnCreatedEventHandler);
chrome.windows.onRemoved.addListener(storeClosedWindow);

// Listen for when a tab is created, updated, or removed
chrome.tabs.onCreated.addListener(tabsOnCreatedEventHandler);
chrome.tabs.onUpdated.addListener(tabsOnUpdatedEventHandler);
chrome.tabs.onRemoved.addListener(storeClosedTabURL);

async function initializationStorage() {
  let { urls, windowId2TabId } = await getCurrentUrls();
  await writeToStorage("urls", urls);
  await writeToStorage("windowId2TabId", windowId2TabId);
}

async function windowsOnCreatedEventHandler() {
  console.log("windows onCreated event happened");
  while (storageLock) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms before retrying
  }
  storageLock = true;
  try {
    let { urls, windowId2TabId } = await getCurrentUrls();
    await writeToStorage("urls", urls);
    await writeToStorage("windowId2TabId", windowId2TabId);
  } catch (error) {
    console.error("Error updating URLs:", error);
  } finally {
    storageLock = false;
  }
}

async function tabsOnCreatedEventHandler() {
  console.log("tabs onCreated event happened");
  while (storageLock) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms before retrying
  }
  storageLock = true;
  try {
    let { urls, windowId2TabId } = await getCurrentUrls();
    await writeToStorage("urls", urls);
    await writeToStorage("windowId2TabId", windowId2TabId);
  } catch (error) {
    console.error("Error updating URLs:", error);
  } finally {
    storageLock = false;
  }
}

async function tabsOnUpdatedEventHandler() {
  console.log("tabs onUpdated event happened");
  while (storageLock) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms before retrying
  }
  storageLock = true;
  try {
    let { urls, windowId2TabId } = await getCurrentUrls();
    await writeToStorage("urls", urls);
    await writeToStorage("windowId2TabId", windowId2TabId);
  } catch (error) {
    console.error("Error updating URLs:", error);
  } finally {
    storageLock = false;
  }
}

async function storeClosedTabURL(tabId, removeInfo) {
  console.log("storeClosedTabURL");
  if (removeInfo.isWindowClosing) {
    return;
  }
  const { urls, windowId2TabId } = await getCurrentUrls();
  while (storageLock) {
    await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for 10ms before retrying
  }
  storageLock = true;
  const storedUrls = await readFromStorage("urls");
  // Check if the length of current urls has 1 more tab than stored urls.
  if (Object.keys(storedUrls).length != Object.keys(urls).length + 1) {
    throw new Error(
      "Invalid history update since the number of current urls is not correct.\n" +
        "current urls: " +
        Object.keys(urls).length +
        "\n" +
        JSON.stringify(urls) +
        "\n\n" +
        " stored urls:" +
        Object.keys(storedUrls).length +
        "\n" +
        JSON.stringify(storedUrls)
    );
  }
  // store the closed url into the history
  let history = await readFromStorage("history");
  if (history == null) {
    history = [];
  }
  history.push([storedUrls[tabId]]);
  await writeToStorage("history", history);

  // Update my recording
  await writeToStorage("urls", urls);
  await writeToStorage("windowId2TabId", windowId2TabId);
  storageLock = false;
}

async function storeClosedWindow(windowId) {
  console.log("storeClosedWindow");
  const { urls, windowId2TabId } = await getCurrentUrls();
  while (storageLock) {
    await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for 100ms before retrying
  }
  storageLock = true;
  const storedUrls = await readFromStorage("urls");
  if (Object.keys(urls).length == Object.keys(storedUrls).length) {
    storageLock = false;
    return;
  }
  const storedWindowId2TabId = await readFromStorage("windowId2TabId");
  console.log(storedWindowId2TabId);
  console.log(storedUrls);
  let windowTabs = [];
  for (const i in storedWindowId2TabId[windowId]) {
    windowTabs.push(storedUrls[storedWindowId2TabId[windowId][i]]);
  }
  let history = await readFromStorage("history");
  if (history == null) {
    history = [];
  }
  history.push(windowTabs);
  await writeToStorage("history", history);
  // Update my recording
  await writeToStorage("urls", urls);
  await writeToStorage("windowId2TabId", windowId2TabId);
  storageLock = false;
}
