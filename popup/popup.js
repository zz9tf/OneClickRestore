const tabs = await chrome.tabs.query({});
const collator = new Intl.Collator();
if (typeof browser === "undefined") {
  var browser = chrome;

function logTabsForWindows(windowInfoArray) {
  for (const windowInfo of windowInfoArray) {
    const window_tamplate = document.getElementById('window_template');
    const win_elem = window_tamplate.content.firstElementChild.cloneNode(true);
    win_elem.querySelector('.window-title').textContent = windowInfo.tabs.length + " tabs";
    const tab_template = document.getElementById("tab_template");
    windowInfo.tabs.forEach(tab => {
      const element = tab_template.content.firstElementChild.cloneNode(true);
      console.log(element);
      if (tab.title.length > 45) {
        element.querySelector('.tab-title').textContent = tab.title.substring(0, 45) + "...";
      } else {
        element.querySelector('.tab-title').textContent = tab.title;
      }
      element.querySelector(".tab-icon").src = tab.favIconUrl;
      // element.querySelector(".a").textContent = tab.url;
      win_elem.querySelector(".window-tabs").append(element);
    });
    document.querySelector(".windows").append(win_elem); 
  }
}

function onError(error) {
  console.error(`Error: ${error}`);
}

browser.windows.getAll({populate: true})
  .then(logTabsForWindows, onError);

// const button = document.querySelector('button');
// button.addEventListener('click', async () => {
//   const tabIds = tabs.map(({ id }) => id);
//   if (tabIds.length) {
//     const group = await chrome.tabs.group({ tabIds });
//     await chrome.tabGroups.update(group, { title: 'DOCS' });
//   }
// });
}