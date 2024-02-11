

function logTabsForWindows(windowInfoArray) {
  const window_tamplate = document.getElementById('window_template');
  const tab_template = document.getElementById("tab_template");
  for (const windowInfo of windowInfoArray) {
    const win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    win_elem.querySelector('.window-title').textContent = windowInfo.tabs.length + " tabs";
    for (const tab of windowInfo.tabs) {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      if (tab.title.length > 45) {
        element.querySelector('.tab-title').textContent = tab.title.substring(0, 45) + "...";
      } else {
        element.querySelector('.tab-title').textContent = tab.title;
      }
      element.querySelector(".tab-icon").src = tab.favIconUrl;
      win_elem.querySelector(".window-tabs").append(element);
    }
    document.querySelector(".windows").append(win_elem); 
  }
}

function logTabsFormHistory (historyArray) {
  const window_tamplate = document.getElementById('window_template');
  const tab_template = document.getElementById("tab_template");

  for (const window of historyArray.reverse()) {
    const win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
      win_elem.querySelector('.window-title').textContent = window.length + " tabs";
      for (const tab of window) {
        const element = tab_template.content.firstElementChild.cloneNode(true);
        console.log(element);
        if (tab.title.length > 45) {
          element.querySelector('.tab-title').textContent = tab.title.substring(0, 45) + "...";
        } else {
          element.querySelector('.tab-title').textContent = tab.title;
        }
        element.querySelector(".tab-icon").src = tab.favIconUrl;
        win_elem.querySelector(".window-tabs").append(element);
      }
      document.querySelector(".windows").append(win_elem); 
  }
}


function onError(error) {
  console.error(`Error: ${error}`);
}

// Initialization
var is_restore_mode = false;
chrome.storage.local.get("mode", function(data) {
  if (typeof data.mode === "undefined") {
    chrome.storage.local.set({mode : false}, function() {
      if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
      }
    });
  } else {
    is_restore_mode = data.mode;
  }
  if (is_restore_mode) {
    chrome.storage.local.get({history : []}, function(data) {
      logTabsFormHistory(data.history);
    })
    toggle.classList.toggle("active");
  } else {
    chrome.windows.getAll({populate: true})
      .then(logTabsForWindows, onError);
  }
})




// Event handlers
const clear_button = document.querySelector(".clear-button");
clear_button.addEventListener("click", function () {
  chrome.storage.local.clear();
  document.querySelector(".windows").innerHTML = "";
  
});


const toggle = document.querySelector(".restore-toggle-button");
toggle.addEventListener("click", () => {
  toggle.classList.toggle("active");
  is_restore_mode = !is_restore_mode;
  chrome.storage.local.set({mode : is_restore_mode}, function() {
    if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
    }
  });
  document.querySelector(".windows").innerHTML = "";
  if (is_restore_mode) {
    chrome.storage.local.get({history : []}, function(data) {
      logTabsFormHistory(data.history);
    }) 
  } else {
    chrome.windows.getAll({populate: true})
      .then(logTabsForWindows, onError);
  }
})

// chrome.tabs.create() -> create a new tab