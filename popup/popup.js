function logTabs(windowArray) {
  console.log("refresh tabs");
  document.querySelector(".windows").innerHTML = "";
  const window_tamplate = document.getElementById("window_template");
  const tab_template = document.getElementById("tab_template");
  // If this is history mode, then reorder the sequence of history based on date and pin.
  if (is_history_mode) {
    let pinWindows = [];
    let otherWindows = [];
    for (let i = windowArray.length-1; i >= 0; i--) {
      windowArray[i].id = i;
      if (windowArray[i].pin) { // If the window block is pinned
        pinWindows.push(windowArray[i]);
      } else { // If the window block is not pinned
        otherWindows.push(windowArray[i]);
      }
    }
    windowArray = pinWindows.concat(otherWindows);
  }
  let date = undefined;
  for (let window of windowArray) {
    let win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    // Set header right icon
    let iconElem = document.createElement("i");
    iconElem.classList.add("fa", "fa-times-circle");
    iconElem.setAttribute("aria-hidden", "true");
    win_elem.querySelector(".window-close").appendChild(iconElem);
    if (is_history_mode) {
      // If this is history mode
      // Set header
      win_elem.querySelector(".window-header").setAttribute("id", JSON.stringify({ "windowId": window.id }));
      // Set header left icon
      iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-external-link");
      iconElem.setAttribute("aria-hidden", "true");
      win_elem.querySelector(".window-restore-icon").appendChild(iconElem);

      iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-thumb-tack");
      iconElem.setAttribute("aria-hidden", "true");
      if (window.pin) {
        win_elem.querySelector(".window-pin-icon").classList.add("active");  
      }
      win_elem.querySelector(".window-pin-icon").appendChild(iconElem);
      // Set date
      const win_date = win_elem.querySelector(".window-date");
      if (date == undefined || date.substring(0, 15) != window.date.substring(0, 15)) {
        win_date.classList.add("special-date");
      }
      date = window.date;
      win_date.textContent = date.substring(0, 24);
      window.urls.id = window.id;
      window = window.urls;
    } else {
      // If this is not history mode
      // Set header left icon
      iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-window-maximize");
      iconElem.setAttribute("aria-hidden", "true");
      win_elem.querySelector(".window-restore-icon").appendChild(iconElem);
      win_elem.querySelector(".window-date").textContent = "";
      win_elem.querySelector(".window-header").setAttribute("id", window.id);
      window = window.tabs;
    }
    win_elem.querySelector(".window-title").textContent = window.length + " tabs";

    let tabId = 0;
    for (const tab of window) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      if (is_history_mode) {
        element.setAttribute("id", JSON.stringify({ "windowId": window.id, "tabId": tabId++ }));
      } else {
        element.setAttribute("id", JSON.stringify({ "windowId": window.id, "tabId": tab.id }));
      }
      element.querySelector(".tab-title").textContent = tab.title;
      element.querySelector(".tab-icon").src = tab.favIconUrl;

      let iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-times-circle");
      iconElem.setAttribute("aria-hidden", "true");
      element.querySelector(".tab-close").appendChild(iconElem);

      win_elem.querySelector(".window-tabs").append(element);
    }
    win_elem.addEventListener('click', tabClickEventHandler);
    document.querySelector(".windows").append(win_elem);
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
const history_mode_button = document.querySelector(".history-mode");

let is_history_mode = await readFromStorage("mode");
if (is_history_mode == null) {
  await writeToStorage("mode", true);
  is_history_mode = await readFromStorage("mode");
  console.log("is_history_mode");
  console.log(is_history_mode);
}

if (is_history_mode) {
  let history = await readFromStorage("history");
  if (history == null) {
    history = [];
  }
  logTabs(history);
  history_mode_button.classList.toggle("active");
} else {
  chrome.windows.getAll({ populate: true }).then(logTabs, onError);
}

// Event handlers
clear.addEventListener("click", clearHandler);
history_mode_button.addEventListener("click", historyModeHandler);
// Set up port between popup and service_worker
const port = await chrome.runtime.connect({ name: "popup" });
port.onMessage.addListener(updateHandler);

async function clearHandler() {
  if (is_history_mode) {
    document.querySelector(".windows").innerHTML = "";
    await writeToStorage("history", []);
  }
}

async function historyModeHandler() {
  history_mode_button.classList.toggle("active");
  is_history_mode = !is_history_mode;
  writeToStorage("mode", is_history_mode)
    .then(async () => {
      if (is_history_mode) {
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
  if (message.operation == "updateHistory" && is_history_mode) {
    console.log("history changed")
    logTabs(message.data);
  } else if (message.operation == "updateUrls" && !is_history_mode) {
    console.log("urls changed");
    chrome.windows.getAll({ populate: true }).then(logTabs, onError);
  }
}

async function tabClickEventHandler(event) {
  console.log("Click event happens");
  const closeElement = event.target.closest(".window-close") || event.target.closest(".tab-close");
  const pinElement = event.target.closest(".window-pin-icon");
  const winElement = event.target.closest('.window-header');
  const tabElement = event.target.closest('.tab');
  // If this is history mode?
  if (is_history_mode) { // yes, this is history mode
    // Is this is a pin operation?
    if (pinElement) { // yes, this is a pin operation
      if (winElement == null) {
        console.log("Error in pin operation that winElement is null");
        return;
      }
      const winId = JSON.parse(winElement.getAttribute('id'));
      let history = await readFromStorage("history");
      history[winId.windowId].pin = !history[winId.windowId].pin;
      await writeToStorage("history", history);
    } else if (tabElement && winElement == null) { // This is a tab clicked clicked event
      // If tab is clicked
      const urlId = JSON.parse(tabElement.getAttribute('id'));
      let history = await readFromStorage("history");
      console.log(urlId);
      const tab = history[urlId.windowId].urls[urlId.tabId];
      if (history[urlId.windowId].urls.length == 1) {
        history.splice(urlId.windowId, 1);
      } else {
        history[urlId.windowId].urls.splice(urlId.tabId, 1);
      }
      await writeToStorage("history", history);
      if (closeElement == null) { // If this is not a close click event
        await chrome.tabs.create({ active: true, url: tab.url });
      }
    } else if (tabElement == null && winElement) { // This is a window block clicked event
      const winId = JSON.parse(winElement.getAttribute('id'));
      console.log(winId);
      console.log(winId.windowId);
      let history = await readFromStorage("history");
      const winTabs = history[winId.windowId].urls.map(tab => tab.url);
      history.splice(winId.windowId, 1);
      await writeToStorage("history", history);
      if (closeElement == null) { // If this is not a close click event
        await chrome.windows.create({ focused: true, url: winTabs });
      }
    }
  } else {
    // If this is not history mode
    if (tabElement && winElement == null) {
      const id = JSON.parse(tabElement.getAttribute('id'));
      if (closeElement) {
        await chrome.tabs.remove(id.tabId);
      } else {
        await chrome.windows.update(id.windowId, { focused: true });
        await chrome.tabs.update(id.tabId, { active: true });
      }
    } else if (tabElement == null && winElement) {
      const winId = JSON.parse(winElement.getAttribute('id'));
      if (closeElement) {
        await chrome.windows.remove(winId);
      } else {
        await chrome.windows.update(winId, { focused: true });
      }

    }
  }
}
