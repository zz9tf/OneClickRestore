function logTabs(windowArray) {
  console.log("refresh tabs");
  document.querySelector(".windows").innerHTML = "";
  const window_tamplate = document.getElementById("window_template");
  const tab_template = document.getElementById("tab_template");
  let windowId = windowArray.length-1;
  if (is_history_mode) {
    console.log("history: ", windowArray)
    windowArray = windowArray.reverse();
  }
  let date = undefined;
  for (let window of windowArray) {
    let win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    if (!is_history_mode) {
      // Set header left icon
      let iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-window-maximize");
      iconElem.setAttribute("aria-hidden", "true");
      win_elem.querySelector(".window-icon").appendChild(iconElem);
      // Set date
      win_elem.querySelector(".window-date").textContent = "";
      window = window.tabs;
    } else {
      // Set header
      win_elem.querySelector(".window-header").setAttribute("id", JSON.stringify({"windowId": windowId}));
      // Set header left icon
      let iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-external-link");
      iconElem.setAttribute("aria-hidden", "true");
      win_elem.querySelector(".window-icon").appendChild(iconElem);
      // Set header right icon
      iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-times-circle");
      iconElem.setAttribute("aria-hidden", "true");
      win_elem.querySelector(".window-close").appendChild(iconElem);
      // Set date
      const win_date = win_elem.querySelector(".window-date");
      if (date == undefined || date.substring(0, 15) != window.date.substring(0, 15)) {
        win_date.classList.add("special-date");
      }
      date = window.date;
      win_date.textContent = date.substring(0, 24);
      window = window.urls;
    }
    win_elem.querySelector(".window-title").textContent = window.length + " tabs";
    
    let tabId = 0;
    for (const tab of window) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      element.setAttribute("id", JSON.stringify({"windowId" : windowId, "tabId" : tabId++}));
      element.querySelector(".tab-title").textContent = tab.title;
      element.querySelector(".tab-icon").src = tab.favIconUrl;

      let iconElem = document.createElement("i");
      iconElem.classList.add("fa", "fa-times-circle");
      iconElem.setAttribute("aria-hidden", "true");
      element.querySelector(".tab-close").appendChild(iconElem);

      win_elem.querySelector(".window-tabs").append(element);
    }
    if (is_history_mode) {
      win_elem.addEventListener('click', clickEventHandler);
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
history_mode_button.addEventListener("mouseover", historyMouseoverHandler);
history_mode_button.addEventListener("mouseleave", historyMouseleaveHandler);
// Set up port between popup and service_worker
const port = chrome.runtime.connect({ name: "popup" });
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

async function clickEventHandler(event) {
  console.log("Click to restore tab");
  const closeElement = event.target.closest(".window-close") || event.target.closest(".tab-close");
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
    if (closeElement == null) {
      chrome.tabs.create({active: true, url: tab.url});
    }
    await writeToStorage("history", history);
    if (closeElement == null) {
      window.close();
    }    
  } else if (tabElement == null && winElement) {
    const winId = JSON.parse(winElement.getAttribute('id'));
    console.log(winId);
    console.log(winId.windowId);
    let history = await readFromStorage("history");
    const winTabs = history[winId.windowId].urls.map(tab => tab.url);
    history.splice(winId.windowId, 1);
    if (closeElement == null) {
      chrome.windows.create({
        focused: true,
        url: winTabs
      });
    }
    await writeToStorage("history", history);
    if (closeElement == null) {
      window.close();
    }
  }
}

async function historyMouseoverHandler() {
  console.log("Mouseover event");
  var rect = history_mode_button.getBoundingClientRect();
  var popoverContent = document.getElementById("history-mode-explain");
  // Calculate the position of the popover relative to the button
  var popoverTop = rect.top+history_mode_button.clientHeight;
  var popoverLeft = rect.left-popoverContent.clientWidth/2;

  // Set the position of the popover
  popoverContent.style.top = popoverTop + "px";
  popoverContent.style.left = popoverLeft + "px";

  // Show the popover
  popoverContent.style.display = "block";
}

async function historyMouseleaveHandler() {
  console.log("Leave event");
  var popoverContent = document.getElementById("history-mode-explain");
  popoverContent.style.display = "none";
}