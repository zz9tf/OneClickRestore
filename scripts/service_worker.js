async function getCurrentUrls() {
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

var mutex = false;

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
  console.log("windows onCreated event happened");
  let { urls, windowId2TabId } = await getCurrentUrls();
  while (mutex == true) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  mutex = true;
  await writeToStorage("urls", urls);
  await writeToStorage("windowId2TabId", windowId2TabId);
  mutex = false;
}

async function storeClosedTabURL(tabId, removeInfo) {
  if (removeInfo.isWindowClosing) {
    return;
  }
  console.log("storeClosedTabURL");
  const { urls, windowId2TabId } = await getCurrentUrls();
  while (mutex == true) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  mutex = true;
  const storedUrls = await readFromStorage("urls");
  // Check if the length of current urls has 1 more tab than stored urls.
  if (Object.keys(storedUrls).length != Object.keys(urls).length + 1) {
    // Get an array of current urls' titles
    const currentTitles = Object.entries(urls).map(([key, value]) => value.title).join("\n");

    // Get an array of stored urls' titles
    const storedTitles = Object.entries(storedUrls).map(([key, value]) => value.title).join("\n");
    throw new Error(
      "Invalid history update since the number of current urls is not correct.\n" +
        "current urls: " +
        Object.keys(urls).length +
        "\n" +
        currentTitles +
        "\n\n" +
        "Try to close the tab: " + storedUrls[tabId].title + 
        "\n\n" +
        " stored urls:" +
        Object.keys(storedUrls).length +
        "\n" +
        storedTitles
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
  mutex = false;
}

async function storeClosedWindow(windowId) {
  console.log("storeClosedWindow");
  const { urls, windowId2TabId } = await getCurrentUrls();
  while (mutex == true) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  mutex = true;
  const storedUrls = await readFromStorage("urls");
  const storedWindowId2TabId = await readFromStorage("windowId2TabId");
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
  mutex = false;
}

async function handlePopupOperation(message) {
  while (mutex == true) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  mutex = true;
  // 2. A page requested user data, respond with a copy of `user`
  if (message[0] === 'readFromStorage') {
    const response = await readFromStorage(message[1]);
    mutex = false;
    return response;
  } else if (message[0] === 'writeToStorage') {
    console.log("write to storage");
    console.log(message);
    await writeToStorage(message[1], message[2])
    const storageData = await readFromStorage(message[1]);
    console.log("storagedData");
    console.log([message[1], storageData]);
    mutex = false;
    return true;
  }
  mutex = false;
  return false;
}