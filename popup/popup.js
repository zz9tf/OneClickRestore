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
    let win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    if (!is_restore_mode) {
      window = window.tabs;
    } else {
      date = window.date;
      window = window.urls;
      win_elem.querySelector(".window-header").setAttribute("id", JSON.stringify({"windowId": windowId}));
      let iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-external-link");
      iconElem.setAttribute("aria-hidden", "true");
      win_elem.querySelector(".window-icon").appendChild(iconElem);
    }
    win_elem.querySelector(".window-title").textContent = window.length + " tabs";
    win_elem.querySelector(".window-date").textContent = date != undefined ? date.substring(0, 24) : "";
    
    let tabId = 0;
    for (const tab of window) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      element.setAttribute("id", JSON.stringify({"windowId" : windowId, "tabId" : tabId++}));
      element.querySelector(".tab-title").textContent = tab.title;
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
  const winElement = event.target.closest('.window-header');
  const tabElement = event.target.closest('.tab');
  if (tabElement && winElement == null) {
    const urlId = JSON.parse(tabElement.getAttribute('id'));
    let history = await readFromStorage("history");
    const tab = history[urlId.windowId].urls[urlId.tabId];
    if (history[urlId.windowId].urls.length == 1) {
      history.splice(urlId.windowId, 1);
    } else {
      history[urlId.windowId].urls.splice(urlId.tabId, 1);
    }
    chrome.tabs.create({active: true, url: tab.url});
    await writeToStorage("history", history);
    window.close();
  } else if (tabElement == null && winElement) {
    const winId = JSON.parse(winElement.getAttribute('id'));
    console.log(winId);
    console.log(winId.windowId);
    let history = await readFromStorage("history");
    const winTabs = history[winId.windowId].urls.map(tab => tab.url);
    history.splice(winId.windowId, 1);
    chrome.windows.create({
      focused: true,
      url: winTabs
    });
    await writeToStorage("history", history);
    window.close();
  }
}
