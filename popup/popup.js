function logTabs(windowArray) {
  console.log("refresh tabs");
  document.querySelector(".windows").innerHTML = "";
  const window_tamplate = document.getElementById("window_template");
  const tab_template = document.getElementById("tab_template");
  let windowId = windowArray.length-1;
  if (is_restore_mode) {
    windowArray = windowArray.reverse();
  }
  for (let window of windowArray) {
    var date = undefined;
    if (!is_restore_mode) {
      window = window.tabs;
    } else {
      date = window.date;
      window = window.urls;
    }
    const win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    win_elem.querySelector(".window-title").textContent = window.length + " tabs";
    
    let tabId = 0;
    for (const tab of window) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      element.setAttribute("id", JSON.stringify({"windowId" : windowId, "tabId" : tabId++}));
      if (tab.title.length > 45) {
        element.querySelector(".tab-title").textContent =
          tab.title.substring(0, 45) + "...";
      } else {
        element.querySelector(".tab-title").textContent = tab.title;
      }
      element.querySelector(".tab-icon").src = tab.favIconUrl;
      win_elem.querySelector(".window-tabs").append(element);
    }
    if (is_restore_mode) {
      win_elem.addEventListener('click', tabRestoreHandler);
    }
    document.querySelector(".windows").append(win_elem);
    windowId--;
  }
  
}

function onError(error) {
  console.error(`Error: ${error}`);
}

async function readFromStorage(key) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(['readFromStorage', key], resolve)
  });
}

async function writeToStorage(key, data) {
  return await chrome.runtime.sendMessage(['writeToStorage', key, data]);
}

// Initialization
const clear = document.querySelector(".clear-button");
const toggle = document.querySelector(".restore-toggle-button");

let is_restore_mode = await readFromStorage("mode");
if (is_restore_mode == null) {
  await writeToStorage("mode", false);
  is_restore_mode = await readFromStorage("mode");
  console.log("is_restore_mode");
  console.log(is_restore_mode);
}

if (is_restore_mode) {
  let history = await readFromStorage("history");
  if (history == null) {
    history = [];
  }
  logTabs(history);
  toggle.classList.toggle("active");
} else {
  chrome.windows.getAll({ populate: true }).then(logTabs, onError);
}

// Event handlers
clear.addEventListener("click", clearHandler);
toggle.addEventListener("click", toggleHandler);
// Set up port between popup and service_worker
const port = chrome.runtime.connect({ name: "popup" });
port.onMessage.addListener(updateHandler);

async function clearHandler() {
  if (is_restore_mode) {
    document.querySelector(".windows").innerHTML = "";
    await writeToStorage("history", []);
  }
}

async function toggleHandler() {
  toggle.classList.toggle("active");
  is_restore_mode = !is_restore_mode;
  writeToStorage("mode", is_restore_mode)
    .then(async () => {
      if (is_restore_mode) {
        let history = await readFromStorage("history");
        if (history == null) {
          history = [];
        }
        logTabs(history);
      } else {
        chrome.windows
          .getAll({ populate: true })
          .then(logTabs, onError);
      }
    })
    .catch(onError);
}

function updateHandler(message) {
  console.log(message);
  if (message.operation == "updateHistory" && is_restore_mode) {
    console.log("history changed")
    logTabs(message.data);
  } else if (message.operation == "updateUrls" && !is_restore_mode) {
    console.log("urls changed");
    chrome.windows.getAll({ populate: true }).then(logTabs, onError);
  }
}

async function tabRestoreHandler(event) {
  console.log("Click to restore tab");
  const tabElement = event.target.closest('.tab');
  if (tabElement) {
    const urlId = JSON.parse(tabElement.getAttribute('id'));
    let history = await readFromStorage("history");
    const tab = history[urlId.windowId].urls[urlId.tabId];
    if (history[urlId.windowId].urls.length == 1) {
      history.splice(urlId.windowId, 1);
    } else {
      history[urlId.windowId].urls.splice(urlId.tabId, 1);
    }
    await writeToStorage("history", history);
    chrome.tabs.create({active: false, url: tab.url});
  }
}
