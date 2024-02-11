var urls = {};
var tabId2window = {}
// Function to update the urls dictionary
function updateUrls() {
    // Query all windows
    chrome.windows.getAll({populate: true}, function(windows) {
        // Clear the existing urls dictionary
        urls = {};
        tabId2window = {};
        
        // Iterate through each window
        windows.forEach(function(window) {
            // Dictionary to store tab IDs mapped to their details
            var windowTabs = {};
            
            // Iterate through each tab in the window
            window.tabs.forEach(function(tab) {
                // Add tab details to the windowTabs dictionary
                windowTabs[tab.id] = {
                    url: tab.url,
                    title: tab.title,
                    favIconUrl: tab.favIconUrl
                    // Add more properties as needed
                };
                tabId2window[tab.id] = window.id;
            });
            
            // Add the windowTabs dictionary to the urls dictionary
            urls[window.id] = windowTabs;
        });
    });
}

// Listen for when a window is created or removed
chrome.windows.onCreated.addListener(updateUrls);
chrome.windows.onRemoved.addListener(storeClosedWindow);

// Listen for when a tab is created, updated, or removed
chrome.tabs.onCreated.addListener(updateUrls);
chrome.tabs.onUpdated.addListener(updateUrls);
chrome.tabs.onRemoved.addListener(storeClosedTabURL);

// Initial update of the urls dictionary
updateUrls();


function storeClosedTabURL(tabId, removeInfo) {
    if (removeInfo.isWindowClosing) {
        return;
    }
    let windowId = tabId2window[tabId];
    let tabInfo = urls[windowId][tabId];
    chrome.storage.local.get({history: []}, function(data) {
        var history = data.history || [];
        history.push([tabInfo]);
        chrome.storage.local.set({ history: history }, function() {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
        });
    });
    updateUrls();
}

function storeClosedWindow (windowId) {
    let windowInfo = urls[windowId];
    chrome.storage.local.get({history: []}, function(data) {
        var history = data.history || [];
        let windowTabs = [];
        for (const tab of Object.values(windowInfo)) {
            windowTabs.push(tab);
        }
        history.push(windowTabs);
        chrome.storage.local.set({ history: history }, function() {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                return;
            }
        });
    });
    updateUrls();
}
